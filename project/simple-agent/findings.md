# Findings & Decisions

## Requirements

从用户需求中提取：
- 参考 opencode 架构和实现方式
- 构建简易版 agent
- 支持 ultra think（深度思考）
- 实现 agent 基本功能
- 支持自定义工具
- 支持 MCP (Model Context Protocol)
- 项目构建在 project/simple-agent/ 目录

## Research Findings

### OpenCode 架构分析

**项目结构**：
- Monorepo 结构 (packages/)
- 核心 CLI: packages/opencode/
- 技术栈：Bun + TypeScript + Solid.js (前端) + Hono (后端)
- AI 集成：Vercel AI SDK v5.0.124
- 数据库：SQLite (Drizzle ORM)

**核心模块**：
1. **Agent** (`packages/opencode/src/agent/agent.ts`)
   - Agent.Info 类型定义
   - 支持 mode: "subagent" | "primary" | "all"
   - 多种预定义 Agent: build, plan, general, explore 等

2. **工具系统** (`packages/openopencode/src/tool/registry.ts`)
   - ToolRegistry 管理工具注册
   - 内置工具：BashTool, ReadTool, WriteTool, GlobTool, GrepTool 等
   - 支持动态工具注册

3. **MCP 集成** (`packages/opencode/src/mcp/index.ts`)
   - 支持 StreamableHTTP 和 Stdio 传输
   - MCP 工具转换为 AI SDK 格式
   - OAuth 认证支持

4. **消息系统** (`packages/opencode/src/session/message-v2.ts`)
   - MessageV2 类型定义
   - 多种 Part 类型：TextPart, ToolPart, ReasoningPart 等

5. **LLM 处理** (`packages/opencode/src/session/llm.ts`)
   - LLM.stream() 处理流式输出
   - 支持多种 Provider

### 用户确认的需求

| 问题 | 回答 |
|------|------|
| 核心定位 | C) 研究/学习目的 |
| 内置工具 | A) 最小化 (Bash, Read, Write) |
| MCP 支持 | A) 完整 MCP 支持 |
| 持久化 | B) JSON 文件存储 |
| 可观测性 | D) 全部包含 (日志+事件+步骤) |
| 模型支持 | D) 多 SDK 兼容 |
| 执行模式 | C) 混合模式 (step/loop) |
| 项目结构 | B) 模块化结构 |

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 使用 Vercel AI SDK | 与 opencode 一致，支持多种 provider |
| 最小化工具集 | 便于学习 agent 核心机制 |
| 完整 MCP 实现 | 提供真实场景的 MCP 集成经验 |
| JSON 持久化 | 简单直观，便于调试和理解 |
| 事件系统 | 提供完整可观测性 |
| 混合执行模式 | 支持调试(step)和自动执行(loop) |

## Dependencies

从 opencode vendor 分析得出的最新稳定版本：
- `ai`: 5.0.124
- `@ai-sdk/openai`: 2.0.89
- `@ai-sdk/anthropic`: 2.0.65
- `zod`: 4.1.8

## Issues Encountered

### 第一轮审查问题
1. AgentEvent/EventData 类型缺失 → 已添加
2. SessionStorage 接口缺失 → 已添加
3. MCP tool execute 缺少 context 参数 → 已修复
4. Agent 类初始化顺序错误 → 已修复
5. OpenAI Provider 代码有问题 → 已重写

### 第二轮审查问题
1. package.json 缺少 `ai` 依赖 → 已添加
2. SessionStorage 后有悬空代码 → 已删除
3. AgentConfig 缺少 mcpServers 属性 → 已添加
4. toolDefs 重复注册 → 已修复

## Resources

- OpenCode vendor: `/Users/liufukang/workplace/AI/vendors/opencode`
- Vercel AI SDK: https://github.com/vercel-labs/ai
- MCP 协议文档: Model Context Protocol

## Visual/Browser Findings

- 设计文档包含数据流示意图，展示 agent 各组件间的消息传递
- 执行流程图清晰展示了 step 和 loop 模式的区别
