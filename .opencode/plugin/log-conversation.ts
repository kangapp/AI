import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { appendFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

// Debug logging
const DEBUG = true
function debug(...args: any[]) {
  if (DEBUG) {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
    const timestamp = new Date().toISOString()
    const logPath = join(process.cwd(), ".opencode", "debug.log")
    appendFileSync(logPath, `[${timestamp}] ${msg}\n`)
  }
}

// State management for current turn
interface TurnState {
  turn: number
  sessionID: string
  shortUUID: string
  filePath: string           // 文件路径，在创建时就确定
  responseWritten: boolean    // 标记 response 是否已写入文件
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
// 追踪每个 sessionID 对应的当前活跃 shortUUID
const activeShortUUIDs = new Map<string, string>()

function getLogPath(sessionID: string, shortUUID: string): string {
  const logDir = join(process.cwd(), ".opencode", "logs")
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  return join(logDir, `${sessionID}_${shortUUID}.jsonl`)
}

// 写入 request 部分到文件
function writeRequestToFile(state: TurnState): void {
  if (!state.request) return

  const timestamp = new Date().toISOString()
  state.filePath = getLogPath(state.sessionID, state.shortUUID)

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

  appendFileSync(state.filePath, JSON.stringify(requestRecord) + "\n")
  debug(`writeRequestToFile: wrote to ${state.filePath}`)
}

// 追加 response 部分到文件
function appendResponseToFile(state: TurnState): void {
  if (!state.request) return
  if (state.responseWritten) return  // 避免重复写入

  state.responseWritten = true

  const timestamp = new Date().toISOString()

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

  appendFileSync(state.filePath, JSON.stringify(responseRecord) + "\n")
  debug(`appendResponseToFile: appended to ${state.filePath}`)
}

export default (input: PluginInput): Promise<Hooks> => {
  return Promise.resolve({
    // 1. 获取 system prompt（在 system prompt 构建完成后调用）
    "experimental.chat.system.transform": async (input, output) => {
      const sessionID = input.sessionID
      if (!sessionID) return
      const shortUUID = activeShortUUIDs.get(sessionID)
      if (!shortUUID) return
      const turnKey = `${sessionID}_${shortUUID}`
      const state = turns.get(turnKey)
      if (!state) return

      state.request.system = output.system
    },

    // 2. 获取 msgs，提取 toolCalls 和 reasoning
    "experimental.chat.messages.transform": async (_, output) => {
      const sessionID = output.messages[0]?.info.sessionID
      if (!sessionID) return

      const lastMsg = output.messages[output.messages.length - 1]
      const isUserMessage = lastMsg?.info?.role === "user"

      // 检测自动系统消息（后台任务完成等），不要为它们创建新文件
      // 只要包含 <!-- OMO_INTERNAL_INITIATOR --> 就是自动触发的消息
      const msgContent = lastMsg?.parts?.map((p: any) => p.text || "").join("") || ""
      const isAutoSystemMessage = msgContent.includes("<!-- OMO_INTERNAL_INITIATOR -->")

      let shortUUID = activeShortUUIDs.get(sessionID)
      let turnKey = shortUUID ? `${sessionID}_${shortUUID}` : null
      let state = turnKey ? turns.get(turnKey) : null

      debug(`chat.messages.transform: isUser=${isUserMessage}, isAuto=${isAutoSystemMessage}, existing shortUUID=${shortUUID}`)

      // 如果是自动系统消息，不创建新文件，继续使用当前 state（如果有）
      if (isAutoSystemMessage) {
        debug(`chat.messages.transform: auto system message, not creating new file`)
        return
      }

      // 如果是 user 消息，且有之前的 state，先写入前一个 turn
      if (isUserMessage && state) {
        debug(`chat.messages.transform: user message, writing previous turn`)
        appendResponseToFile(state)
        turns.delete(turnKey)
        activeShortUUIDs.delete(sessionID)  // 清除 shortUUID
        state = null
        shortUUID = null
      }

      // 如果是 user 消息，创建新 turn
      if (isUserMessage) {
        // 如果还没有 shortUUID，生成一个新的
        if (!shortUUID) {
          shortUUID = crypto.randomUUID().substring(0, 12)
          activeShortUUIDs.set(sessionID, shortUUID)
        }
        turnKey = `${sessionID}_${shortUUID}`

        // 检查是否已经为此 shortUUID 创建了文件，避免重复
        const existingFilePath = getLogPath(sessionID, shortUUID)
        if (existsSync(existingFilePath)) {
          debug(`chat.messages.transform: file already exists for shortUUID=${shortUUID}, skipping`)
          // 更新现有的 state 而不是创建新的
          const existingState = turns.get(turnKey)
          if (existingState) {
            state = existingState
          }
          return
        }

        // 获取 system prompt
        const systemMessages = output.messages.filter((m: any) => m.info?.role === "system")
        const system = systemMessages.map((m: any) =>
          m.parts.map((p: any) => p.text || "").join("")
        )

        // 获取 agent 和 model
        const agent = lastMsg?.info?.agent || "unknown"
        const model = lastMsg?.info?.model || { providerID: "unknown", modelID: "unknown" }

        // 只保存当前 user 消息
        const currentMessages = [{
          role: "user",
          content: lastMsg.parts,
        }]

        state = {
          turn: 1,  // 每个文件都从 turn 1 开始
          sessionID,
          shortUUID,
          filePath: "",
          responseWritten: false,
          request: {
            messages: currentMessages,
            system,
            agent,
            model,
          },
          response: { texts: [], reasoning: [], toolCalls: [], tools: [] },
        }
        turns.set(turnKey, state)
        debug(`chat.messages.transform: created new state`)

        // 立即写入 request
        writeRequestToFile(state)
        return
      }

      // 如果没有 state（非 user 消息触发），直接返回
      if (!state) {
        debug(`chat.messages.transform: no state, returning`)
        return
      }

      // assistant 消息：更新 request.messages 为当前 assistant 消息
      if (lastMsg?.info?.role === "assistant") {
        state.request.messages = [{
          role: "assistant",
          content: lastMsg.parts,
        }]
        debug(`chat.messages.transform: updated assistant message`)
      }
    },

    // 3. 收集文本输出
    "experimental.text.complete": async (input, output) => {
      const shortUUID = activeShortUUIDs.get(input.sessionID)
      if (!shortUUID) return
      const turnKey = `${input.sessionID}_${shortUUID}`
      const state = turns.get(turnKey)
      if (!state) return

      state.response.texts.push(output.text)
    },

    // 4. 收集工具调用（在执行前记录）
    "tool.execute.before": async (input, output) => {
      const shortUUID = activeShortUUIDs.get(input.sessionID)
      if (!shortUUID) return
      const turnKey = `${input.sessionID}_${shortUUID}`
      const state = turns.get(turnKey)
      if (!state) return

      // 在 toolCall 开始时记录，保持 toolCalls 和 tools 的顺序一致
      state.response.toolCalls.push({
        id: input.callId,
        tool: input.tool,
        args: input.args,
        callID: input.callId,
      })
    },

    // 5. 收集工具执行结果
    "tool.execute.after": async (input, output) => {
      const shortUUID = activeShortUUIDs.get(input.sessionID)
      if (!shortUUID) return
      const turnKey = `${input.sessionID}_${shortUUID}`
      const state = turns.get(turnKey)
      if (!state) return

      state.response.tools.push({
        tool: input.tool,
        args: input.args,
        output: output.output,
        title: output.title,
      })
    },

    // 5. event hook
    "event": async (input) => {
      const event = input.event as any
      debug(`event: type=${event.type}`)

      if (event.type === "message.part.updated") {
        const part = event.properties?.part
        if (part?.type === "step-finish") {
          const sessionID = part.sessionID
          const reason = part.reason
          debug(`step-finish: reason=${reason}`)
          const shortUUID = activeShortUUIDs.get(sessionID)
          if (!shortUUID) return
          const turnKey = `${sessionID}_${shortUUID}`
          const state = turns.get(turnKey)
          if (!state) return

          // Turn 结束条件：reason 是 stop/length/content-filter，或未知 reason 但不是 tool-calls
          // 注意：不要在这里清除 shortUUID，因为可能还有后续消息
          const isTurnEnd = reason === "stop" || reason === "length" || reason === "content-filter" ||
                            reason == null
          if (isTurnEnd) {
            debug(`step-finish: reason=${reason}, appending response`)
            appendResponseToFile(state)
          } else {
            debug(`step-finish: reason=${reason}, not ending turn`)
          }
        }
        return
      }

      if (event.type === "session.deleted") {
        const sessionID = event.data?.info?.id
        if (!sessionID) return

        const shortUUID = activeShortUUIDs.get(sessionID)
        if (shortUUID) {
          const turnKey = `${sessionID}_${shortUUID}`
          const state = turns.get(turnKey)
          if (state && state.request) {
            if (state.filePath) {
              appendResponseToFile(state)
            } else {
              writeRequestToFile(state)
              appendResponseToFile(state)
            }
          }
          turns.delete(turnKey)
        }

        activeShortUUIDs.delete(sessionID)
      }
    },
  })
}
