import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { appendFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

const DEBUG = true
const debugLog = (msg: string) => {
  if (!DEBUG) return
  const logDir = join(process.cwd(), ".opencode", "logs")
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
  const logPath = join(logDir, "debug.log")
  appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`)
}

debugLog("[LLM-LOG] plugin loaded")

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
  debugLog("[LLM-LOG] plugin initialized")
  return Promise.resolve({
    "experimental.chat.messages.transform": async (_, output) => {
      debugLog("[LLM-LOG] chat.messages.transform called, messages count: " + output.messages.length)
      // Get sessionID from the first message's sessionID
      const sessionID = output.messages[0]?.info.sessionID
      if (!sessionID) {
        debugLog("[LLM-LOG] chat.messages.transform: no sessionID")
        return
      }

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
        debugLog("[LLM-LOG] Created new turn state for session: " + sessionID)
      }

      // Increment turn counter
      state.turn++
      debugLog("[LLM-LOG] Turn: " + state.turn + " for session: " + sessionID)

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
      debugLog("[LLM-LOG] text.complete called for session: " + input.sessionID + " text length: " + output.text.length)
      const state = turns.get(input.sessionID)
      if (!state) return

      state.response.texts.push(output.text)
    },

    "tool.execute.after": async (input, output) => {
      debugLog("[LLM-LOG] tool.execute.after called for session: " + input.sessionID + " tool: " + input.tool)
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
      debugLog("[LLM-LOG] chat.message called for session: " + input.sessionID)
      // Write previous turn's data when new message arrives
      const sessionID = input.sessionID
      const state = turns.get(sessionID)

      if (!state || !state.request) {
        debugLog("[LLM-LOG] chat.message: no state or request to write")
        return
      }

      debugLog("[LLM-LOG] Writing turn " + state.turn + " to jsonl")

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
      debugLog("[LLM-LOG] Writing to: " + logPath)
      appendFileSync(logPath, JSON.stringify(requestRecord) + "\n")
      appendFileSync(logPath, JSON.stringify(responseRecord) + "\n")
      debugLog("[LLM-LOG] Write complete")
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
