/**
 * Tool system type definitions
 */

import { z } from "zod";

/**
 * Context passed to tool execution
 */
export interface ToolContext {
  // deno-lint-ignore no-explicit-any
  [key: string]: any;
}

/**
 * Result returned from tool execution
 */
export interface ToolResult {
  success: boolean;
  result?: string;
  error?: string;
}

/**
 * Tool definition for LLM function calling
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Base Tool interface that all tools must implement
 */
export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute(params: unknown, context: ToolContext): Promise<ToolResult>;
}
