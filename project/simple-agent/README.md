# Simple Agent

一个基于 TypeScript 的模块化 Agent 框架，支持多种 LLM 提供者、工具系统和 MCP 集成。

## 特性

- **多 LLM 提供者支持**: OpenAI、Anthropic（支持 MiniMax 等兼容 API）
- **内置工具**: BashTool、ReadTool、WriteTool
- **MCP 集成**: 支持 Model Context Protocol 标准工具
- **会话存储**: JSON 文件会话持久化
- **事件系统**: 完整的事件订阅机制
- **多种执行模式**: Step 模式（单步执行）和 Loop 模式（循环执行）

## 安装

```bash
bun install
```

## 快速开始

### 使用 CLI

```bash
# 使用 OpenAI
bun src/index.ts --prompt "列出当前目录的文件" --provider openai --api-key $OPENAI_API_KEY

# 使用 Anthropic/MiniMax
bun src/index.ts --prompt "列出当前目录的文件" --provider anthropic --model MiniMax-M2.7 --api-key $ANTHROPIC_API_KEY

# 指定 Base URL（用于 MiniMax 等兼容 API）
bun src/index.ts --prompt "列出当前目录的文件" \
  --provider anthropic \
  --model MiniMax-M2.7 \
  --base-url https://api.minimaxi.com/anthropic/v1 \
  --api-key $ANTHROPIC_API_KEY

# 使用会话恢复
bun src/index.ts --prompt "继续之前的任务" --session session-12345
```

### 环境变量配置

```bash
# OpenAI
export OPENAI_API_KEY=sk-xxx
export OPENAI_BASE_URL=https://api.openai.com/v1  # 可选

# Anthropic / MiniMax
export ANTHROPIC_API_KEY=sk-cp-xxx
export ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic/v1
export MODEL=MiniMax-M2.7
```

### 使用 Example

```bash
# 运行基础示例
bun examples/basic.ts
```

## 架构

```
simple-agent/
├── src/
│   ├── agent/        # Agent 核心逻辑
│   │   ├── agent.ts  # Agent 主类
│   │   ├── loop.ts   # 循环执行模式
│   │   └── step.ts   # 单步执行模式
│   ├── llm/          # LLM 提供者
│   │   ├── base.ts   # 基础接口
│   │   ├── openai.ts # OpenAI 提供者
│   │   └── anthropic.ts # Anthropic 提供者
│   ├── tools/        # 内置工具
│   │   ├── bash.ts   # Bash 工具
│   │   ├── read.ts   # 读取文件工具
│   │   └── write.ts  # 写入文件工具
│   ├── mcp/          # MCP 集成
│   ├── storage/      # 会话存储
│   └── events/       # 事件系统
├── examples/
│   └── basic.ts      # 基础示例
└── tests/            # 测试文件
```

## API 使用

### 创建 Agent

```typescript
import { Agent } from 'simple-agent';
import { BashTool, ReadTool, WriteTool } from 'simple-agent/tools';

const agent = new Agent({
  provider: 'anthropic',  // 'openai' | 'anthropic'
  model: 'MiniMax-M2.7',
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.minimaxi.com/anthropic/v1',  // 可选
  maxIterations: 10,  // 最大迭代次数
});
```

### 注册工具

```typescript
agent.registerTools([
  new BashTool(),
  new ReadTool(),
  new WriteTool(),
]);
```

### 订阅事件

```typescript
agent.on('agent:start', (data) => console.log('Agent 启动:', data));
agent.on('agent:complete', () => console.log('Agent 完成'));
agent.on('tool:call', (data) => console.log('工具调用:', data));
agent.on('tool:result', (data) => console.log('工具结果:', data));
```

### 执行任务

```typescript
const messages = [
  { role: 'user', content: '列出当前目录的文件' },
];

for await (const stepResult of agent.run(messages, 'loop')) {
  switch (stepResult.type) {
    case 'message':
      console.log('助手:', stepResult.content);
      break;
    case 'tool-call':
      console.log('工具调用:', stepResult.metadata);
      break;
    case 'tool-result':
      console.log('工具结果:', stepResult.content);
      break;
    case 'done':
      console.log('执行完成');
      break;
    case 'error':
      console.error('错误:', stepResult.content);
      break;
  }
}
```

## 内置工具

### BashTool

执行 Bash 命令。

```typescript
new BashTool()
// 调用示例: bash { command: "ls -la" }
```

### ReadTool

读取文件内容。

```typescript
new ReadTool()
// 调用示例: read { path: "package.json" }
```

### WriteTool

写入文件内容。

```typescript
new WriteTool()
// 调用示例: write { path: "output.txt", content: "Hello World" }
```

## CLI 选项

| 选项 | 简写 | 默认值 | 描述 |
|------|------|--------|------|
| `--prompt` | `-p` | 必填 | 用户提示词 |
| `--model` | `-m` | `gpt-4o` | 模型名称 |
| `--provider` | - | `openai` | 提供者: `openai` \| `anthropic` |
| `--mode` | - | `loop` | 执行模式: `step` \| `loop` |
| `--session` | - | - | 会话 ID（用于恢复） |
| `--api-key` | - | - | API 密钥 |
| `--base-url` | - | - | API Base URL |

## 测试

```bash
bun test
```

## License

MIT
