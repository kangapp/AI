import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFile, rm } from "fs/promises";
import { ReadTool } from "./read";

describe("ReadTool", () => {
  let tool: ReadTool;
  const testFilePath = "/tmp/test-read-tool.txt";

  beforeEach(async () => {
    tool = new ReadTool();
    // Create a test file
    await writeFile(testFilePath, "line1\nline2\nline3\nline4\nline5", "utf-8");
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await rm(testFilePath);
    } catch {
      // ignore
    }
  });

  test("has correct name and description", () => {
    expect(tool.name).toBe("read");
    expect(tool.description).toBe("Read the contents of a file");
  });

  test("reads entire file when no lines specified", async () => {
    const result = await tool.execute({ path: testFilePath }, {});

    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.result!);
    expect(parsed.content).toBe("line1\nline2\nline3\nline4\nline5");
  });

  test("reads limited lines when specified", async () => {
    const result = await tool.execute(
      { path: testFilePath, lines: 3 },
      {}
    );

    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.result!);
    expect(parsed.content).toBe("line1\nline2\nline3");
  });

  test("returns error for non-existent file", async () => {
    const result = await tool.execute(
      { path: "/tmp/non-existent-file.txt" },
      {}
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("throws on invalid parameters", () => {
    expect(() => tool.execute({}, {})).toThrow();
    expect(() => tool.execute({ path: 123 }, {})).toThrow();
  });
});
