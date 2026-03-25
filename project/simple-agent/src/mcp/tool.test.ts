import { describe, test, expect } from "bun:test";
import { convertMcpInputSchema, convertMcpToolDefinition } from "./tool";
import type { MCPTool } from "./types";

describe("convertMcpInputSchema", () => {
  test("converts string property", () => {
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "The name" },
      },
      required: ["name"],
    };

    const zodSchema = convertMcpInputSchema(schema);
    const result = zodSchema.safeParse({ name: "test" });
    expect(result.success).toBe(true);
  });

  test("converts number property", () => {
    const schema = {
      type: "object" as const,
      properties: {
        age: { type: "number", description: "The age" },
      },
    };

    const zodSchema = convertMcpInputSchema(schema);
    const result = zodSchema.safeParse({ age: 25 });
    expect(result.success).toBe(true);
  });

  test("converts boolean property", () => {
    const schema = {
      type: "object" as const,
      properties: {
        active: { type: "boolean", description: "Is active" },
      },
    };

    const zodSchema = convertMcpInputSchema(schema);
    const result = zodSchema.safeParse({ active: true });
    expect(result.success).toBe(true);
  });

  test("converts array property", () => {
    const schema = {
      type: "object" as const,
      properties: {
        items: { type: "array", items: { type: "string" } },
      },
    };

    const zodSchema = convertMcpInputSchema(schema);
    const result = zodSchema.safeParse({ items: ["a", "b", "c"] });
    expect(result.success).toBe(true);
  });

  test("converts nested object property", () => {
    const schema = {
      type: "object" as const,
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
          },
          required: ["name"],
        },
      },
    };

    const zodSchema = convertMcpInputSchema(schema);
    const result = zodSchema.safeParse({
      user: { name: "John", email: "john@example.com" },
    });
    expect(result.success).toBe(true);
  });

  test("handles empty schema", () => {
    const schema = { type: "object" as const };
    const zodSchema = convertMcpInputSchema(schema);
    const result = zodSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("convertMcpToolDefinition", () => {
  test("converts basic MCP tool to tool definition", () => {
    const mcpTool: MCPTool = {
      name: "test-tool",
      description: "A test tool",
      inputSchema: {
        type: "object",
        properties: {
          input: { type: "string" },
        },
        required: ["input"],
      },
    };

    const definition = convertMcpToolDefinition(mcpTool);
    expect(definition.name).toBe("test-tool");
    expect(definition.description).toBe("A test tool");
    expect(definition.parameters.type).toBe("object");
    expect(definition.parameters.properties).toEqual({ input: { type: "string" } });
    expect(definition.parameters.required).toEqual(["input"]);
  });

  test("handles tool without description", () => {
    const mcpTool: MCPTool = {
      name: "no-desc-tool",
      inputSchema: { type: "object" },
    };

    const definition = convertMcpToolDefinition(mcpTool);
    expect(definition.name).toBe("no-desc-tool");
    expect(definition.description).toBe("");
  });

  test("handles tool without required fields", () => {
    const mcpTool: MCPTool = {
      name: "optional-tool",
      description: "Tool with optional fields",
      inputSchema: {
        type: "object",
        properties: {
          optional: { type: "string" },
        },
      },
    };

    const definition = convertMcpToolDefinition(mcpTool);
    expect(definition.parameters.required).toBeUndefined();
  });
});
