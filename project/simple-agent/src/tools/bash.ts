/**
 * BashTool - Execute shell commands
 */

import { z } from "zod";
import { spawn } from "bun";
import type { Tool, ToolContext, ToolResult } from "./types";

/**
 * Parameters for BashTool
 */
const BashParameters = z.object({
  command: z.string().describe("The shell command to execute"),
});

/**
 * Tool for executing shell commands
 */
export class BashTool implements Tool {
  name = "bash";
  description = "Execute a shell command and return the result";
  parameters = BashParameters;

  async execute(params: unknown, _context: ToolContext): Promise<ToolResult> {
    const parsed = BashParameters.parse(params);
    const { command } = parsed;

    try {
      const process = spawn({
        cmd: ["sh", "-c", command],
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr] = await Promise.all([
        process.stdout.text(),
        process.stderr.text(),
      ]);

      await process.exited;
      const exitCode = process.exitCode;

      return {
        success: exitCode === 0,
        result: JSON.stringify({
          stdout,
          stderr,
          exitCode,
        }),
        error: exitCode !== 0 ? stderr : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
