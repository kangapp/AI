import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin"
import { appendFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

// State management for current turn
interface TurnState {
  turn: number
  sessionID: string
  request: {
    messages: any[]
    system: string[]
    agent: string
    model: { providerID: string; modelID: string }
  } | null
  response: {
    texts: string[]
    tools: { tool: string; args: any; output: string; title: string }[]
  }
}

const turns = new Map<string, TurnState>()

function getLogPath(sessionID: string): string {
  const logDir = join(process.cwd(), ".opencode", "logs")
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  return join(logDir, `${sessionID}.jsonl`)
}

export default (input: PluginInput): Promise<Hooks> => {
  return Promise.resolve({
    "experimental.chat.messages.transform": async (_, output) => {
      // TODO: collect request data
    },

    "experimental.text.complete": async (input, output) => {
      // TODO: collect text output
    },

    "tool.execute.after": async (input, output) => {
      // TODO: collect tool calls
    },

    "chat.message": async (input, output) => {
      // TODO: write previous turn to jsonl
    },
  })
}
