# Code Review Agent 设计文档

## 概述

在 `project/code-review-agent/` 构建一个 code review CLI，使用 `project/simple-agent/` 作为 dependency。

## 目标

创建一个 CLI 工具，让用户可以用自然语言指定要 review 的内容：
- `code-review-agent "帮我 review PR 12"`
- `code-review-agent "review 当前 branch 新代码"`
- `code-review-agent "review commit 13bad5 之后的代码"`

## 文件结构

```
project/code-review-agent/
├── package.json          # 依赖 simple-agent
├── tsconfig.json
├── src/
│   └── index.ts          # CLI 入口
└── prompts/
    └── system.md        # code review system prompt（含详细 git/gh 工具文档）
```

## 工作流程

1. CLI 接收自然语言参数
2. 验证 API key 和必要环境
3. 读取 `prompts/system.md` 作为 system prompt
4. 将用户输入拼接为 user prompt
5. 调用 simple-agent 执行
6. simple-agent 内部使用 BashTool/ReadTool/WriteTool 完成 review
7. 输出结果到终端 + 生成报告文件到 `reviews/` 目录

## 系统提示词设计 (prompts/system.md)

### 工具定义

#### 1. Read Tool
- 用途：读取文件内容
- 场景：阅读 diff 涉及的完整文件、README、约定文件

#### 2. Write Tool
- 用途：写入文件
- 场景：生成 review 报告文件

#### 3. Bash Tool (Git)

**决策逻辑：**
```
如果用户提到 PR 号 -> 使用 gh pr view/diff
如果用户提到分支名 -> 使用 git diff branchA...branchB
如果用户提到 commit hash -> 使用 git show 或 git diff
如果用户没有明确指定范围 -> 默认与 main/master/dev 对比
```

**完整的使用场景对照表：**

| 用户输入 | 分析意图 | 执行的命令 |
|---------|---------|-----------|
| "review 当前 branch" | 与 main 对比 | `git diff main...HEAD` |
| "review 当前 branch 相对于 develop" | 与 develop 对比 | `git diff develop...HEAD` |
| "review commit 13bad5 之后" | 从某 commit 到现在 | `git diff 13bad5..HEAD` |
| "review 这个 commit" | 查看单个 commit | `git show 13bad5` |
| "review 某个文件" | 查看文件变更 | `git diff main...HEAD -- path` |
| "review 未提交的内容" | 查看工作区 | `git diff` |
| "review 已暂存的内容" | 查看暂存区 | `git diff --cached` |
| "review 从 main 到现在" | 同 review 当前 branch | `git diff main...HEAD` |
| "查看分支差异" | 分支间对比 | `git diff branchA...branchB` |
| "查看变更文件列表" | 快速获取变更文件 | `git diff --name-only` |
| "查看 stash" | 查看 stash 内容 | `git stash list` + `git stash show` |
| "查看提交历史" | 查看 commit 记录 | `git log --oneline -10` |
| "查看当前分支" | 确认当前分支 | `git branch --show-current` |
| "查看文件在某个 commit 的内容" | 查看历史版本 | `git show <commit>:<file>` |

#### 4. Bash Tool (Gh)

**决策逻辑：**
```
如果用户提到 PR 号或 URL -> 优先使用 gh 命令
如果用户提到 github.com -> 解析 URL 获取 owner/repo/pr number
```

**完整的使用场景对照表：**

| 用户输入 | 执行的命令 |
|---------|-----------|
| "review PR 12" | `gh pr view 12` + `gh pr diff 12` |
| "review https://github.com/x/y/pull/123" | `gh pr view 123 --repo x/y` + `gh pr diff 123 --repo x/y` |
| "看看这个 PR 的状态" | `gh pr view 12 --comments` |
| "查看当前分支的 PR" | `gh pr view --web` |
| "列出所有 open PR" | `gh pr list --state open` |
| "查看 PR 评论" | `gh pr view 12 --comments` |
| "查看某个用户的 PR" | `gh pr list --author <username> --state open` |

### 审查流程

#### 完整流程（分步）

**第一步：确定审查范围**
1. 解析用户输入，判断意图
2. 选择对应的 git/gh 命令
3. 执行命令获取 diff

**第二步：探索项目上下文**
1. 读取 README.md 了解项目
2. 查找并读取约定文件：AGENTS.md, CONVENTIONS.md, .editorconfig
3. 查看项目结构：`ls -la`, `find . -name '*.ts' | head -20`

**第三步：获取变更文件列表**
1. 执行 `git diff --name-only` 获取变更文件
2. 读取每个变更文件的完整内容
3. 读取相关测试文件（如有）

**第四步：执行审查**
按以下维度审查代码：
1. **Bug（主要）** - 逻辑错误、边界条件、安全问题、错误处理
2. **代码质量** - 命名、重复、嵌套、可读性
3. **架构契合度** - 符合项目约定、使用已有抽象
4. **性能** - 明显性能问题
5. **行为变更** - 有意为之？

**第五步：输出结果**
1. 终端输出简洁摘要
2. 生成完整报告：`reviews/YYYY-MM-DD-<target>.md`

### 输出规范

#### 终端输出
```
## Code Review: [审查目标]

### 严重问题
[文件:行号] [问题描述]

### 建议改进
[改进建议]
```

#### 报告文件
```markdown
# Code Review Report

**审查目标**: [branch/PR/commit/文件]
**审查时间**: YYYY-MM-DD
**审查范围**: [文件列表]

---

## 严重问题 (Severity: High)
...

## 中等问题 (Severity: Medium)
...

## 建议改进 (Severity: Low)
...

## 总结
```

## CLI 实现 (src/index.ts)

```typescript
import { Agent } from 'simple-agent';
import { BashTool, ReadTool, WriteTool } from 'simple-agent';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { config } from 'dotenv';

// 加载环境变量
config({ override: true });

// 验证 API key
const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Error: API key required. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
  process.exit(1);
}

// 解析 CLI 参数
const args = process.argv.slice(2);

// 处理 --help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: code-review-agent "<自然语言描述要 review 的内容>"
Example: code-review-agent "review PR 12"
         code-review-agent "review 当前 branch 新代码"
         code-review-agent "review commit 13bad5 之后的代码"`);
  process.exit(0);
}

const userInput = args.join(' ');
if (!userInput) {
  console.error('Usage: code-review-agent "<自然语言描述要 review 的内容>"');
  console.error('Example: code-review-agent "review PR 12"');
  process.exit(1);
}

// 读取 system prompt
let systemPrompt = '';
try {
  systemPrompt = readFileSync('./prompts/system.md', 'utf-8');
} catch {
  console.error('Error: prompts/system.md not found');
  process.exit(1);
}

// 确保 reviews 目录存在
try {
  mkdirSync('./reviews', { recursive: true });
} catch {}

// provider 类型验证
const envProvider = process.env.PROVIDER;
const validProviders = ['openai', 'anthropic'];
const provider = envProvider && validProviders.includes(envProvider)
  ? envProvider as 'openai' | 'anthropic'
  : 'openai';

// model 默认值
const model = process.env.MODEL || 'gpt-4o';

// 创建 agent
const agentConfig = {
  provider,
  model,
  apiKey,
};

const agent = new Agent(agentConfig);
agent.registerTools([new BashTool(), new ReadTool(), new WriteTool()]);

// 构建 messages（system prompt 直接添加到数组中）
const messages = [
  { role: 'system' as const, content: systemPrompt },
  { role: 'user' as const, content: userInput },
];

// 收集输出用于生成报告文件
const outputBuffer: string[] = [];
const date = new Date().toISOString().split('T')[0];
const reportFileName = `reviews/${date}-review-report.md`;

console.log('[Code Review Agent] Starting...\n');

for await (const result of agent.run(messages, 'loop')) {
  switch (result.type) {
    case 'message':
      if (result.content) {
        console.log(result.content);
        outputBuffer.push(result.content);
      }
      break;
    case 'tool-call':
      console.log(`[Tool] ${result.metadata?.name || 'unknown'}`);
      outputBuffer.push(`\n[Tool] ${result.metadata?.name || 'unknown'}`);
      break;
    case 'tool-result':
      const content = result.content || '';
      console.log(`[Result] ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`);
      break;
    case 'done':
      console.log('\n[Done] Review completed');

      // 生成报告文件
      if (outputBuffer.length > 0) {
        const reportContent = `# Code Review Report

**审查时间**: ${date}
**用户输入**: ${userInput}

---

${outputBuffer.join('\n\n')}

---
*Generated by Code Review Agent*
`;
        try {
          writeFileSync(reportFileName, reportContent, 'utf-8');
          console.log(`\n[Report] Saved to ${reportFileName}`);
        } catch (e) {
          console.warn('[Warning] Could not save report file');
        }
      }
      break;
    case 'error':
      console.error('[Error]', result.content);
      break;
  }
}
```

## 依赖

```json
{
  "dependencies": {
    "simple-agent": "file:../simple-agent",
    "dotenv": "^17.3.1"
  }
}
```

## 错误处理

| 场景 | 处理方式 |
|-----|---------|
| 无 API key | 友好提示并退出 |
| 无用户输入 | 显示 usage 并退出 |
| reviews/ 目录创建失败 | 继续执行（报告仅输出到终端） |
| gh/git 命令失败 | agent 自动重试或标记为无法审查 |

## 验收标准

- [ ] CLI 可通过 `bun src/index.ts "review PR 12"` 执行
- [ ] system.md 包含完整的 git/gh 使用场景对照表
- [ ] review 结果同时输出到终端和 reviews/ 目录
- [ ] agent 具备探索项目上下文的能力
- [ ] 无 API key 时有友好错误提示
- [ ] 无用户输入时显示 usage
- [ ] reviews/ 目录自动创建
- [ ] 支持 `--help` 参数
