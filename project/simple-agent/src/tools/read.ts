/**
 * ReadTool - Read file contents
 */

import { z } from "zod";
import { readFile } from "fs/promises";
import type { Tool, ToolContext, ToolResult } from "./types";

/**
 * Parameters for ReadTool
 */
const ReadParameters = z.object({
  path: z.string().describe("The path to the file to read"),
  lines: z.number().optional().describe("Maximum number of lines to read"),
});

/**
 * Tool for reading file contents
 */
export class ReadTool implements Tool {
  name = "read";
  description = "Read the contents of a file";
  parameters = ReadParameters;

  async execute(params: unknown, _context: ToolContext): Promise<ToolResult> {
    const parsed = ReadParameters.parse(params);
    const { path, lines } = parsed;

    try {
      let content: string;

      if (lines !== undefined && lines > 0) {
        // Read file and split into lines
        const fileContent = await readFile(path, "utf-8");
        const allLines = fileContent.split("\n");
        content = allLines.slice(0, lines).join("\n");
      } else {
        content = await readFile(path, "utf-8");
      }

      return {
        success: true,
        result: JSON.stringify({ content }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
