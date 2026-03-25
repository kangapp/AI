import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readFile, rm } from "fs/promises";
import { WriteTool } from "./write";

describe("WriteTool", () => {
  let tool: WriteTool;
  const testFilePath = "/tmp/test-write-tool.txt";

  beforeEach(() => {
    tool = new WriteTool();
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
    expect(tool.name).toBe("write");
    expect(tool.description).toBe("Write content to a file");
  });

  test("writes content to file successfully", async () => {
    const content = "Hello, World!";
    const result = await tool.execute(
      { path: testFilePath, content },
      {}
    );

    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.result!);
    expect(parsed.success).toBe(true);

    // Verify file was written
    const readContent = await readFile(testFilePath, "utf-8");
    expect(readContent).toBe(content);
  });

  test("overwrites existing file content", async () => {
    // First write
    await tool.execute({ path: testFilePath, content: "original" }, {});

    // Second write
    const result = await tool.execute(
      { path: testFilePath, content: "updated" },
      {}
    );

    expect(result.success).toBe(true);

    // Verify file was overwritten
    const readContent = await readFile(testFilePath, "utf-8");
    expect(readContent).toBe("updated");
  });

  test("writes multiline content", async () => {
    const content = "line1\nline2\nline3";
    await tool.execute({ path: testFilePath, content }, {});

    const readContent = await readFile(testFilePath, "utf-8");
    expect(readContent).toBe(content);
  });

  test("throws on invalid parameters", () => {
    expect(() => tool.execute({}, {})).toThrow();
    expect(() => tool.execute({ path: 123 }, {})).toThrow();
    expect(() => tool.execute({ path: "test.txt" }, {})).toThrow();
  });
});
