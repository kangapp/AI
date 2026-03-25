/**
 * WriteTool - Write content to a file
 */

import { z } from "zod";
import { writeFile } from "fs/promises";
import type { Tool, ToolContext, ToolResult } from "./types";

/**
 * Parameters for WriteTool
 */
const WriteParameters = z.object({
  path: z.string().describe("The path to the file to write"),
  content: z.string().describe("The content to write to the file"),
});

/**
 * Tool for writing content to files
 */
export class WriteTool implements Tool {
  name = "write";
  description = "Write content to a file";
  parameters = WriteParameters;

  async execute(params: unknown, _context: ToolContext): Promise<ToolResult> {
    const parsed = WriteParameters.parse(params);
    const { path, content } = parsed;

    try {
      await writeFile(path, content, "utf-8");

      return {
        success: true,
        result: JSON.stringify({ success: true }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
