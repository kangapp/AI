# CLAUDE.md

## 核心原则

### KISS 原则

1. **简单优先** - 选择最直接的实现，避免过度抽象
2. **单一职责** - 每个模块只做一件事
3. **不做假想** - 不为未来可能的需求编写代码
4. **可读性优先** - 清晰胜于聪明

### 代码质量

| 层面 | 要求 |
|------|------|
| 类型安全 | Rust: `#![deny(missing_docs)]` / TS: `strict: true` |
| 错误处理 | 禁止 `unwrap()`/`any`，使用 `Result`/具体类型 |
| 文档 | 所有 public API 必须有注释 |
| 测试 | 核心模块必须有单元测试 |

### 命名规范

| 类型 | Rust | TypeScript |
|------|------|------------|
| 函数 | `snake_case` | `camelCase` |
| 类型 | `PascalCase` | `PascalCase` |
| 常量 | `SCREAMING_SNAKE_CASE` | `SCREAMING_SNAKE_CASE` |
| Hook | - | `use` 前缀 |

---

## 核心工作流：规划与执行 (HOW)

开发强制要求融合 planning-with-files (持久化记忆) 与 superpowers (协议化执行) 框架。

### 1. 规划阶段 (Brainstorming & Planning)

- **设计优先**：在编写任何代码前，必须调用 /superpowers:brainstorm 进行苏格拉底式需求拆解
- **设计持久化**：将 Brainstorm 的架构结论同步至 findings.md
- **任务分发**：使用 /superpowers:write-plan 生成 2-5 分钟的微型任务，必须将其同步至 task_plan.md 的阶段路线图中, 以task_plan.md 为主

### 2. 状态维护规则 (Context Engineering)

- **2-Action Rule**：每进行 2 次搜索（WebSearch）或查看（WebFetch/Read）操作后，必须立即更新 findings.md 以防止信息在上下文压缩时丢失
- **Read-Before-Decide**：在启动新阶段或进行重大决策前，强制读取 task_plan.md 的前 30 行以对齐目标
- **进度审计**：每完成一个子任务，需更新 progress.md 记录具体的文件变更和测试结果, 更新task_plan.md 更新任务清单

### 3. 错误处理协议 (3-Strike Protocol)

严禁盲目重试：遵循 3-Strike 协议。第一次失败尝试修复；第二次失败尝试替代方案；第三次失败必须在 task_plan.md 的错误表中记录失败日志，并主动询问用户。

### 4. 编码与验证

- **编码阶段**：复杂任务严格遵守 RED-GREEN-REFACTOR 流程，调用 /superpowers:test-driven-development 先写测试，验证失败，再实现代码，最后重构
- **验证阶段**: 任务完成后调用 /superpowers:verification-before-completion，通过读取测试工具的实时输出来确认成功，严禁“推测式成功” 。
- **原子提交**：每个阶段完成后，生成符合 Conventional Commits 标准的 Git 提交

### 5.目录与文件说明
- **task_plan.md**: 阶段追踪与任务清单。
- **findings.md**: 技术决策、API 结构及研究结论。
- **progress.md**: 会话日志、测试结果及错误记录 。

---

## 常用开发命令

| 操作 | 命令 |
|------|------|
| 初始化环境 | /planning-with-files:start |
| 架构设计 | /superpowers:brainstorm |
| 生成计划 | /superpowers:write-plan |
| 执行任务 | /superpowers:execute-plan |

---

## 开发宪章

## 动态上下文引用

- @task_plan.md
- @findings.md
- @progress.md
