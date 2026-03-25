import { describe, test, expect, beforeEach } from "bun:test";
import { ToolRegistry } from "./registry";
import { BashTool } from "./bash";
import { ReadTool } from "./read";
import { WriteTool } from "./write";

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  test("register adds a tool to the registry", () => {
    const tool = new BashTool();
    registry.register(tool);
    expect(registry.get("bash")).toBe(tool);
  });

  test("register throws if tool with same name already exists", () => {
    const tool = new BashTool();
    registry.register(tool);
    expect(() => registry.register(tool)).toThrow(
      'Tool with name "bash" is already registered'
    );
  });

  test("get returns undefined for non-existent tool", () => {
    expect(registry.get("nonExistent")).toBeUndefined();
  });

  test("list returns all registered tools", () => {
    const bash = new BashTool();
    const read = new ReadTool();
    const write = new WriteTool();

    registry.register(bash);
    registry.register(read);
    registry.register(write);

    const tools = registry.list();
    expect(tools).toHaveLength(3);
    expect(tools).toContain(bash);
    expect(tools).toContain(read);
    expect(tools).toContain(write);
  });

  test("getDefinitions returns tool definitions for LLM", () => {
    const bash = new BashTool();
    const read = new ReadTool();
    const write = new WriteTool();

    registry.register(bash);
    registry.register(read);
    registry.register(write);

    const definitions = registry.getDefinitions();
    expect(definitions).toHaveLength(3);

    const bashDef = definitions.find((d) => d.name === "bash");
    expect(bashDef).toBeDefined();
    expect(bashDef?.description).toBe("Execute a shell command and return the result");

    const readDef = definitions.find((d) => d.name === "read");
    expect(readDef).toBeDefined();
    expect(readDef?.description).toBe("Read the contents of a file");

    const writeDef = definitions.find((d) => d.name === "write");
    expect(writeDef).toBeDefined();
    expect(writeDef?.description).toBe("Write content to a file");
  });
});
