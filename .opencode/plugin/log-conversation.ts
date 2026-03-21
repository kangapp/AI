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
      const state = turns.get(input.sessionID)
      if (!state) return

      state.response.tools.push({
        tool: input.tool,
        args: input.args,
        output: output.output,
        title: output.title,
      })
    },

    "chat.message": async (input, output) => {
      // Write previous turn's data when new message arrives
      const sessionID = input.sessionID
      const state = turns.get(sessionID)

      if (!state || !state.request) return

      // Get current timestamp
      const timestamp = new Date().toISOString()

      // Write request record
      const requestRecord = {
        type: "request",
        turn: state.turn,
        sessionID: state.sessionID,
        timestamp,
        model: state.request.model,
        agent: state.request.agent,
        system: state.request.system,
        messages: state.request.messages,
      }

      // Write response record
      const responseRecord = {
        type: "response",
        turn: state.turn,
        sessionID: state.sessionID,
        timestamp,
        texts: state.response.texts,
        fullText: state.response.texts.join(""),
        tools: state.response.tools,
      }

      const logPath = getLogPath(sessionID)
      appendFileSync(logPath, JSON.stringify(requestRecord) + "\n")
      appendFileSync(logPath, JSON.stringify(responseRecord) + "\n")
    },

    "event": async (input) => {
      const event = input.event as any
      // session.updated 或 session.deleted 时写入剩余数据
      if (event.type === "session.updated" || event.type === "session.deleted") {
        const sessionID = event.data?.info?.id
        if (!sessionID) return

        const state = turns.get(sessionID)
        if (!state || !state.request) return

        // Write remaining turn data
        const timestamp = new Date().toISOString()
        const logPath = getLogPath(sessionID)

        const requestRecord = {
          type: "request",
          turn: state.turn,
          sessionID: state.sessionID,
          timestamp,
          model: state.request.model,
          agent: state.request.agent,
          system: state.request.system,
          messages: state.request.messages,
        }

        const responseRecord = {
          type: "response",
          turn: state.turn,
          sessionID: state.sessionID,
          timestamp,
          texts: state.response.texts,
          fullText: state.response.texts.join(""),
          tools: state.response.tools,
        }

        appendFileSync(logPath, JSON.stringify(requestRecord) + "\n")
        appendFileSync(logPath, JSON.stringify(responseRecord) + "\n")

        // Clean up state
        turns.delete(sessionID)
      }
    },
  })
}
