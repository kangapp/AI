import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { appendFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

// State management for current turn
interface TurnState {
  turn: number
  sessionID: string
  shortUUID: string
  turnKey: string
  request: {
    messages: any[]           // 完整的消息
    system: string[]          // system prompt（从 system.transform 获取）
    agent: string
    model: { providerID: string; modelID: string }
  } | null
  response: {
    texts: string[]           // 文本输出片段
    reasoning: string[]       // 思考过程（从 messages 提取）
    toolCalls: {             // 工具调用（从 messages 提取）
      id: string
      tool: string
      args: any
      callID: string
    }[]
    tools: {                 // 工具执行结果
      tool: string
      args: any
      output: string
      title: string
    }[]
  }
}

const turns = new Map<string, TurnState>()

function getLogPath(sessionID: string, shortUUID?: string): string {
  const logDir = join(process.cwd(), ".opencode", "logs")
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  const baseName = shortUUID ? `${sessionID}_${shortUUID}` : sessionID
  return join(logDir, `${baseName}.jsonl`)
}

export default (input: PluginInput): Promise<Hooks> => {
  return Promise.resolve({
    // 1. 获取 system prompt（在 system prompt 构建完成后调用）
    "experimental.chat.system.transform": async (input, output) => {
      const sessionID = input.sessionID
      if (!sessionID) return
      const state = turns.get(sessionID)
      if (!state) return

      state.request.system = output.system
    },

    // 2. 获取 msgs，提取 toolCalls 和 reasoning
    "experimental.chat.messages.transform": async (_, output) => {
      const sessionID = output.messages[0]?.info.sessionID
      if (!sessionID) return

      // 检测是否是 user 消息（新 turn 的开始）
      const hasUserMessage = output.messages.some((m: any) => m.info.role === "user")

      let turnKey: string
      let state = turns.get(sessionID)

      if (hasUserMessage) {
        // 生成 shortUUID 并创建新的 turnState
        const shortUUID = crypto.randomUUID().substring(0, 12)
        turnKey = `${sessionID}_${shortUUID}`

        state = {
          turn: 0,
          sessionID,
          shortUUID,
          turnKey,
          request: null as any,
          response: { texts: [], reasoning: [], toolCalls: [], tools: [] },
        }
        turns.set(turnKey, state)
        // 同时用 sessionID 作为 key 存储一份，方便其他 hook 查找
        turns.set(sessionID, state)
      } else if (!state) {
        return
      } else {
        turnKey = state.turnKey
      }

      state.turn++

      // 提取消息，保留完整 parts
      const messages = output.messages.map((m: any) => ({
        role: m.info.role,
        content: m.parts,
      }))

      // 从 assistant 消息中提取 tool calls 和 reasoning
      const assistantMessages = output.messages.filter((m: any) => m.info.role === "assistant")
      const toolCalls: any[] = []
      const reasoning: string[] = []

      for (const msg of assistantMessages) {
        for (const part of msg.parts) {
          if (part.type === "tool") {
            toolCalls.push({
              id: part.id,
              tool: part.tool,
              args: part.state.input,
              callID: part.callID,
            })
          }
          if (part.type === "reasoning") {
            reasoning.push(part.text)
          }
        }
      }

      // 获取 system prompt（此时可能为空，等 system.transform 补充）
      const systemMessages = output.messages.filter((m: any) => m.info.role === "system")
      const system = systemMessages.map((m: any) =>
        m.parts.map((p: any) => p.text || "").join("")
      )

      // 获取 agent 和 model
      const lastMessage = output.messages[output.messages.length - 1]
      const agent = lastMessage?.info.agent || "unknown"
      const model = lastMessage?.info.model || { providerID: "unknown", modelID: "unknown" }

      state.request = {
        messages,
        system,
        agent,
        model,
      }

      // 重置 response 收集器，保存从 messages 提取的数据
      state.response = {
        texts: [],
        reasoning,
        toolCalls,
        tools: [],
      }
    },

    // 3. 收集文本输出
    "experimental.text.complete": async (input, output) => {
      const state = turns.get(input.sessionID)
      if (!state) return

      state.response.texts.push(output.text)
    },

    // 4. 收集工具执行结果
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

    // 5. event hook: 检测 step-finish 并写入 jsonl
    "event": async (input) => {
      const event = input.event as any

      if (event.type === "message.part.updated") {
        const part = event.properties?.part
        if (part?.type === "step-finish") {
          const sessionID = part.sessionID
          const state = turns.get(sessionID)

          if (!state || !state.request) return

          const timestamp = new Date().toISOString()

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
            reasoning: state.response.reasoning,
            toolCalls: state.response.toolCalls,
            tools: state.response.tools,
            finishReason: part.reason,
            usage: {
              tokens: part.tokens,
              cost: part.cost,
            },
          }

          const logPath = getLogPath(sessionID, state.shortUUID)
          appendFileSync(logPath, JSON.stringify(requestRecord) + "\n")
          appendFileSync(logPath, JSON.stringify(responseRecord) + "\n")
        }
        return
      }

      if (event.type === "session.deleted") {
        const sessionID = event.data?.info?.id
        if (!sessionID) return

        const state = turns.get(sessionID)
        if (!state || !state.request) return

        const timestamp = new Date().toISOString()
        const logPath = getLogPath(sessionID, state.shortUUID)

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
          reasoning: state.response.reasoning,
          toolCalls: state.response.toolCalls,
          tools: state.response.tools,
        }

        appendFileSync(logPath, JSON.stringify(requestRecord) + "\n")
        appendFileSync(logPath, JSON.stringify(responseRecord) + "\n")

        turns.delete(sessionID)
        turns.delete(state.turnKey)
      }
    },
  })
}
