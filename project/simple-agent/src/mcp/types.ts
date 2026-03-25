/**
 * MCP (Model Context Protocol) type definitions
 */

// JSON-RPC 2.0 message types
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JSONRPCNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

// MCP transport types
export type TransportType = "stdio" | "streamable-http";

/**
 * MCP configuration for establishing connections
 */
export interface MCPConfig {
  name: string;
  transport: TransportType;
  // Stdio transport options
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // HTTP transport options
  url?: string;
}

/**
 * MCP tool definition from server
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: MCPInputSchema;
}

export interface MCPInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
}

/**
 * MCP initialization result
 */
export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface MCPCapabilities {
  tools?: Record<string, unknown>;
}

/**
 * Connection state for MCP client
 */
export interface MCPConnection {
  name: string;
  config: MCPConfig;
  transport: MCPTransport;
  initialized: boolean;
}

/**
 * Base transport interface
 */
export interface MCPTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: JSONRPCRequest | JSONRPCNotification): Promise<unknown>;
  onMessage(handler: (message: JSONRPCResponse | JSONRPCNotification) => void): void;
  onError(handler: (error: Error) => void): void;
}

/**
 * List tools result from MCP server
 */
export interface MCPListToolsResult {
  tools: MCPTool[];
}
