import { describe, test, expect, beforeEach } from "bun:test";
import { BashTool } from "./bash";

describe("BashTool", () => {
  let tool: BashTool;

  beforeEach(() => {
    tool = new BashTool();
  });

  test("has correct name and description", () => {
    expect(tool.name).toBe("bash");
    expect(tool.description).toBe(
      "Execute a shell command and return the result"
    );
  });

  test("executes a simple command successfully", async () => {
    const result = await tool.execute({ command: "echo 'hello'" }, {});

    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();

    const parsed = JSON.parse(result.result!);
    expect(parsed.stdout).toBe("hello\n");
    expect(parsed.stderr).toBe("");
    expect(parsed.exitCode).toBe(0);
  });

  test("returns error for failed command", async () => {
    const result = await tool.execute(
      { command: "exit 1" },
      {}
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("handles command with pipes", async () => {
    const result = await tool.execute(
      { command: "echo 'line1\nline2' | grep line1" },
      {}
    );

    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.result!);
    expect(parsed.stdout).toContain("line1");
  });

  test("throws on invalid parameters", () => {
    expect(() => tool.execute({}, {})).toThrow();
    expect(() => tool.execute({ command: 123 }, {})).toThrow();
  });
});
