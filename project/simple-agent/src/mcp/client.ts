/**
 * MCP Client implementation
 *
 * Manages connections to MCP servers and provides access to MCP tools
 */

import { z } from "zod";
import { StdioTransport, StreamableHTTPTransport, MCPTransport } from "./transport";
import {
  MCPConfig,
  MCPConnection,
  MCPTool,
  JSONRPCRequest,
  MCPListToolsResult,
  MCPInitializeResult,
} from "./types";
import { ToolContext, ToolResult, Tool, ToolDefinition } from "../tools/types";
import { convertMcpInputSchema, createMcpToolExecutor } from "./tool";

/**
 * MCP Client for connecting to MCP servers
 */
export class MCPClient {
  private connections: Map<string, MCPConnection> = new Map();
  private toolToServer: Map<string, string> = new Map();

  /**
   * Connect to an MCP server with the given configuration
   */
  async connect(config: MCPConfig): Promise<void> {
    if (this.connections.has(config.name)) {
      throw new Error(`MCP server "${config.name}" is already connected`);
    }

    let transport: MCPTransport;

    switch (config.transport) {
      case "stdio":
        if (!config.command) {
          throw new Error("command is required for stdio transport");
        }
        transport = new StdioTransport(config.command, config.args || [], config.env || {});
        break;
      case "streamable-http":
        if (!config.url) {
          throw new Error("url is required for streamable-http transport");
        }
        transport = new StreamableHTTPTransport(config.url);
        break;
      default:
        throw new Error(`Unknown transport type: ${config.transport}`);
    }

    await transport.connect();

    const connection: MCPConnection = {
      name: config.name,
      config,
      transport,
      initialized: false,
    };

    // Initialize the connection with MCP protocol handshake
    await this.initialize(connection);

    this.connections.set(config.name, connection);
  }

  /**
   * Initialize MCP connection with protocol handshake
   */
  private async initialize(connection: MCPConnection): Promise<void> {
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: "simple-agent",
          version: "0.1.0",
        },
      },
    };

    await connection.transport.send(request);

    // Send initialized notification
    await connection.transport.send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    connection.initialized = true;
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnect(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (!connection) {
      throw new Error(`MCP server "${name}" is not connected`);
    }

    await connection.transport.disconnect();
    this.connections.delete(name);

    // Clean up toolToServer entries belonging to this server
    for (const [toolName, serverName] of this.toolToServer.entries()) {
      if (serverName === name) {
        this.toolToServer.delete(toolName);
      }
    }
  }

  /**
   * List all available tools from all connected MCP servers
   */
  async listTools(): Promise<Tool[]> {
    const allTools: Tool[] = [];

    for (const [serverName, connection] of this.connections) {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: this.generateId(),
        method: "tools/list",
      };

      const result = (await connection.transport.send(request) as unknown) as MCPListToolsResult;
      const mcpTools = result.tools || [];

      for (const mcpTool of mcpTools) {
        const tool = this.createTool(serverName, mcpTool);
        allTools.push(tool);
      }
    }

    return allTools;
  }

  /**
   * List tool definitions (for LLM function calling) from all connected servers
   */
  async listToolDefinitions(): Promise<ToolDefinition[]> {
    const tools = await this.listTools();
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Call a tool by its qualified name (format: "serverName:toolName")
   * The name can also be just the tool name if it was registered via createTool
   */
  async callTool(name: string, args: unknown): Promise<unknown> {
    let serverName: string;
    let toolName: string;

    // Check if name contains a server prefix (format: "serverName:toolName")
    if (name.includes(":")) {
      const lastColonIndex = name.lastIndexOf(":");
      serverName = name.substring(0, lastColonIndex);
      toolName = name.substring(lastColonIndex + 1);
    } else {
      // Look up server from registered tools
      serverName = this.toolToServer.get(name) || name;
      toolName = name;
    }

    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`MCP server "${serverName}" is not connected`);
    }

    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: this.generateId(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const result = await connection.transport.send(request);
    return result;
  }

  /**
   * Create a Tool instance from an MCP tool
   */
  private createTool(serverName: string, mcpTool: MCPTool): Tool {
    const fullName = `${serverName}:${mcpTool.name}`;
    const zodSchema = convertMcpInputSchema(mcpTool.inputSchema);

    // Register tool name to server mapping for callTool routing
    this.toolToServer.set(fullName, serverName);

    return {
      name: fullName,
      description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
      parameters: zodSchema,
      execute: createMcpToolExecutor(mcpTool, (name, args) =>
        this.callTool(name, args)
      ),
    };
  }

  /**
   * Generate a unique ID for JSON-RPC requests
   */
  private generateId(): number {
    return Math.floor(Math.random() * 1000000);
  }

  /**
   * Get all connected server names
   */
  getConnectedServers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Check if a server is connected
   */
  isConnected(name: string): boolean {
    return this.connections.has(name);
  }
}
