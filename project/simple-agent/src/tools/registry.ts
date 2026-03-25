/**
 * Tool Registry for managing and accessing tools
 */

import { zodToJsonSchema } from "zod-to-json-schema";
import type { Tool, ToolDefinition } from "./types";

/**
 * Registry for managing tools
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool with the registry
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions for LLM
   */
  getDefinitions(): ToolDefinition[] {
    return this.list().map((tool) => {
      return {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters) as ToolDefinition["parameters"],
      };
    });
  }
}
