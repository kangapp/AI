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
      // Get sessionID from the first message's sessionID
      const sessionID = output.messages[0]?.info.sessionID
      if (!sessionID) return

      // Get or create turn state
      let state = turns.get(sessionID)
      if (!state) {
        state = {
          turn: 0,
          sessionID,
          request: null,
          response: { texts: [], tools: [] },
        }
        turns.set(sessionID, state)
      }

      // Increment turn counter
      state.turn++

      // Extract messages for LLM
      const messages = output.messages.map((m: any) => ({
        role: m.info.role,
        content: m.parts,
      }))

      // Get system prompt from messages (first system message if any)
      const systemMessages = output.messages.filter((m: any) => m.info.role === "system")
      const system = systemMessages.map((m: any) =>
        m.parts.map((p: any) => p.text || "").join("")
      )

      // Get agent and model from message metadata
      const lastMessage = output.messages[output.messages.length - 1]
      const agent = lastMessage?.info.agent || "unknown"
      const model = lastMessage?.info.model || { providerID: "unknown", modelID: "unknown" }

      state.request = {
        messages,
        system,
        agent,
        model,
      }

      // Reset response collector for new turn
      state.response = { texts: [], tools: [] }
    },

    "experimental.text.complete": async (input, output) => {
      const state = turns.get(input.sessionID)
      if (!state) return

      state.response.texts.push(output.text)
    },

    "tool.execute.after": async (input, output) => {
      // TODO: collect tool calls
    },

    "chat.message": async (input, output) => {
      // TODO: write previous turn to jsonl
    },
  })
}
