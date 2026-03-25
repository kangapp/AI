/**
 * MCP Tool conversion utilities
 *
 * Converts MCP tools (with JSON Schema inputSchema) to agent Tool format
 */

import { z } from "zod";
import type { MCPTool } from "./types";
import type { ToolContext, ToolResult, ToolDefinition, Tool } from "../tools/types";

/**
 * Convert an MCP tool's inputSchema to a Zod schema
 */
export function convertMcpInputSchema(inputSchema: MCPTool["inputSchema"]): z.ZodSchema {
  const properties: Record<string, z.ZodTypeAny> = {};

  if (inputSchema.properties) {
    for (const [key, value] of Object.entries(inputSchema.properties)) {
      properties[key] = jsonSchemaToZod(value as JSONSchemaProperty);
    }
  }

  const required = inputSchema.required || [];

  const schema = z.object(properties);
  if (required.length > 0) {
    return schema.refine(
      (data) => required.every((key) => key in data),
      { message: `Missing required fields: ${required.join(", ")}` }
    );
  }
  return schema;
}

interface JSONSchemaProperty {
  type?: string;
  description?: string;
  enum?: unknown[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/**
 * Convert a JSON Schema property to a Zod type
 */
function jsonSchemaToZod(schema: JSONSchemaProperty): z.ZodTypeAny {
  switch (schema.type) {
    case "string":
      return z.string().describe(schema.description || "");
    case "number":
      return z.number().describe(schema.description || "");
    case "integer":
      return z.number().int().describe(schema.description || "");
    case "boolean":
      return z.boolean().describe(schema.description || "");
    case "array":
      if (schema.items) {
        return z.array(jsonSchemaToZod(schema.items)).describe(schema.description || "");
      }
      return z.array(z.unknown()).describe(schema.description || "");
    case "object":
      if (schema.properties) {
        const objProperties: Record<string, z.ZodTypeAny> = {};
        for (const [key, value] of Object.entries(schema.properties)) {
          objProperties[key] = jsonSchemaToZod(value);
        }
        return z.object(objProperties).describe(schema.description || "");
      }
      return z.record(z.string(), z.unknown()).describe(schema.description || "");
    default:
      return z.unknown().describe(schema.description || "");
  }
}

/**
 * Convert an MCP tool definition to an agent Tool definition
 */
export function convertMcpToolDefinition(mcpTool: MCPTool): ToolDefinition {
  return {
    name: mcpTool.name,
    description: mcpTool.description || "",
    parameters: {
      type: "object",
      properties: mcpTool.inputSchema.properties || {},
      required: mcpTool.inputSchema.required,
    },
  };
}

/**
 * Create a wrapper function for calling MCP tools
 * Returns a function that can be used as a tool executor
 */
export function createMcpToolExecutor(
  mcpTool: MCPTool,
  callToolFn: (name: string, args: unknown) => Promise<unknown>
): (params: unknown, context: ToolContext) => Promise<ToolResult> {
  return async (params: unknown, _context: ToolContext): Promise<ToolResult> => {
    try {
      const result = await callToolFn(mcpTool.name, params);
      return {
        success: true,
        result: JSON.stringify(result),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

/**
 * Convert an MCP tool to a Tool with execute function
 * The callToolFn should have signature: (name: string, args: any) => Promise<any>
 */
export function convertMcpTool(
  mcpTool: MCPTool,
  callToolFn: (name: string, args: unknown) => Promise<unknown>
): Tool {
  return {
    name: mcpTool.name,
    description: mcpTool.description || "",
    parameters: convertMcpInputSchema(mcpTool.inputSchema),
    execute: createMcpToolExecutor(mcpTool, callToolFn),
  };
}
