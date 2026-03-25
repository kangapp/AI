/**
 * MCP (Model Context Protocol) - Exports
 */

export { MCPClient } from "./client";

// Transport exports
export { StdioTransport, StreamableHTTPTransport } from "./transport";
export type { MCPTransport } from "./transport";

// Tool exports
export { convertMcpToolDefinition, convertMcpInputSchema } from "./tool";

// Types
export type {
  MCPConfig,
  MCPConnection,
  MCPTool,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  JSONRPCError,
  MCPInitializeResult,
  MCPCapabilities,
  MCPListToolsResult,
  MCPInputSchema,
  TransportType,
} from "./types";
