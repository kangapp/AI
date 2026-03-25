# Task Plan: Simple Agent Implementation

## Goal

构建一个面向研究和学习的简易版 Agent，参考 opencode 架构，支持 LLM 调用、工具系统、MCP 集成、JSON 会话持久化。

## Current Phase

Phase 0 (Planning Complete)

## Phases

### Phase 0: Design & Planning
- [x] 参考 opencode 架构进行分析
- [x] 需求澄清和设计方案确定
- [x] 编写设计规范文档
- [x] 编写实现计划
- [x] 计划审查通过
- **Status:** complete

### Phase 1: Project Setup
- [ ] 创建 package.json 和 tsconfig.json
- [ ] 创建全局类型定义 (src/types.ts)
- **Status:** pending

### Phase 2: Event System
- [ ] 实现 EventEmitter (src/events/emitter.ts)
- [ ] 编写测试
- **Status:** pending

### Phase 3: Storage System
- [ ] 实现 JsonSessionStorage (src/storage/json.ts)
- [ ] 编写测试
- **Status:** pending

### Phase 4: LLM Abstraction Layer
- [ ] 实现 BaseLLMProvider 和类型定义
- [ ] 实现 OpenAIProvider
- [ ] 实现 AnthropicProvider
- [ ] 创建 Provider 工厂函数
- **Status:** pending

### Phase 5: Tool System
- [ ] 实现 ToolRegistry
- [ ] 实现 BashTool, ReadTool, WriteTool
- [ ] 编写测试
- **Status:** pending

### Phase 6: MCP Integration
- [ ] 实现传输层 (Stdio, StreamableHTTP)
- [ ] 实现 MCPClient
- [ ] 实现 MCP 工具转换
- **Status:** pending

### Phase 7: Agent Core
- [ ] 实现 Agent 主类
- [ ] 实现 step 模式
- [ ] 实现 loop 模式
- **Status:** pending

### Phase 8: CLI Entry Point
- [ ] 创建 CLI 入口 (src/index.ts)
- **Status:** pending

### Phase 9: Examples
- [ ] 创建 basic.ts 示例
- [ ] 创建 mcp.ts 示例
- [ ] 创建 custom-tool.ts 示例
- **Status:** pending

### Phase 10: Testing & Verification
- [ ] 运行完整测试
- [ ] 验证功能完整性
- **Status:** pending

## Reference Documents

| Document | Path |
|----------|------|
| 设计规范 | `docs/2026-03-25-simple-agent-design.md` |
| 实现计划 | `docs/2026-03-25-simple-agent-implementation.md` |

## Dependencies Version

| Package | Version |
|---------|---------|
| ai | 5.0.124 |
| @ai-sdk/openai | 2.0.89 |
| @ai-sdk/anthropic | 2.0.65 |
| zod | 4.1.8 |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Bun + TypeScript | 与 opencode 一致，更快的启动速度 |
| 最小化工具集 (Bash, Read, Write) | 聚焦 agent 核心机制，便于学习 |
| JSON 文件持久化 | 简单直观，便于调试 |
| 完整 MCP 支持 | 支持远程/本地 MCP 服务器 |
| 混合执行模式 (step/loop) | 支持调试和生产使用 |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| None yet | - | - |

## Notes

- 执行方式：使用 superpowers:subagent-driven-development 或手动执行
- 参考 opencode vendor: `/Users/liufukang/workplace/AI/vendors/opencode`
