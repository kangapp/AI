# Code Review Agent Loop 增强设计

**日期**: 2026-03-28
**状态**: 设计完成
**目标**: 解决 AI 在信息收集不完整时提前结束 loop 的问题

---

## 背景问题

当前 code-review-agent 的 loop 机制存在以下问题：

1. **AI 跳过文件读取步骤** - AI 在还没真正读取文件的情况下就声称"已读取所有文件"
2. **Loop 提前终止** - 当 AI 输出 message（而非 tool-call）时，loop 误判为"任务完成"
3. **路径探索不足** - AI 使用了不存在的绝对路径（`project/simple-agent/src/...`）

### 根本原因

Loop 的终止条件过于简单：只检测"是否有 tool_calls"，而不理解 AI 输出的语义。

---

## 设计决策

| 决策点 | 选择 |
|--------|------|
| Loop 终止判断 | AI 显式声明 `**__REVIEW_COMPLETE__**` 或 `**__PHASE: COMPLETE__**` |
| 路径探索 | 信任 AI 用 `pwd`/`ls`/`find` 自己探索，不硬编码路径 |
| 报告输出 | 终端完整输出 + 文件持久化 |
| 完成标记 | `**__REVIEW_COMPLETE__**` 或 `**__PHASE: COMPLETE__**` |

---

## 方案 2：Loop 增强（Prompt + 代码）

### 第一部分：System Prompt 改造

#### 1.1 阶段声明系统

AI 在执行过程中需要声明当前阶段：

```
## 阶段声明格式

在每个关键动作前，AI 必须声明当前阶段：

### 阶段类型

1. **信息收集阶段**：`**__PHASE: COLLECTING__**`
   - AI 正在调用 git/read 工具收集信息
   - Loop 应继续等待，不输出分析

2. **分析阶段**：`**__PHASE: ANALYZING__**`
   - AI 正在处理已收集的信息
   - Loop 继续等待工具结果

3. **完成阶段**：`**__PHASE: COMPLETE__**`
   - AI 准备输出最终报告
   - Loop 检测到此标记后输出结果并结束
```

#### 1.2 环境探索鼓励

```
## 环境探索

如不确定文件路径或项目结构，可使用：
- `pwd` - 确认当前目录
- `ls` - 列出目录内容
- `find . -name "filename"` - 查找文件

AI 应自行探索以获取准确路径，不依赖预设路径知识。
```

#### 1.3 完成声明

```
## 完成声明

当审查完成后，必须输出以下标记之一：

`**__REVIEW_COMPLETE__**`

或完整格式：

`**__REVIEW_COMPLETE__**
**__PHASE: COMPLETE__**

此标记表示审查正式结束，loop 将输出报告并终止。
```

#### 1.4 中间分析声明（可选但推荐）

当 AI 需要输出中间分析时，应使用：

```
`**__PHASE: ANALYZING__**`
```

示例：
```
**__PHASE: ANALYZING__**

我正在查看 diff 中的关键变更...
```

---

### 第二部分：Loop 增强逻辑

#### 2.1 Loop 状态机

```
                    ┌─────────────────┐
                    │   COLLECTING     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    工具调用成功                    工具调用失败
              │                             │
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │ 等待工具结果     │           │  重试/跳过      │
    │ 保持 ANALYZING  │           │  继续 COLLECTING│
    └────────┬────────┘           └─────────────────┘
             │
             │ AI 输出 message (无 tool_calls)
             │
             ▼
    ┌─────────────────────────────────────┐
    │ 检测 message 内容中的阶段标记          │
    │                                       │
    │ - **__PHASE: COMPLETE__** → 终止    │
    │ - **__REVIEW_COMPLETE__** → 终止    │
    │ - **__PHASE: ANALYZING__** → 继续   │
    │ - **__PHASE: COLLECTING__** → 继续   │
    │ - 无标记 + 有内容 → 检查是否像报告    │
    └─────────────────────────────────────┘
```

#### 2.2 阶段检测函数

```typescript
// loop.ts 中新增

type Phase = 'collecting' | 'analyzing' | 'complete' | 'unknown';

/**
 * 从 AI 的 message content 中提取阶段信息
 */
function detectPhase(content: string): Phase {
  if (content.includes('**__PHASE: COMPLETE__**') ||
      content.includes('**__REVIEW_COMPLETE__**')) {
    return 'complete';
  }
  if (content.includes('**__PHASE: ANALYZING__**')) {
    return 'analyzing';
  }
  if (content.includes('**__PHASE: COLLECTING__**')) {
    return 'collecting';
  }
  return 'unknown';
}

/**
 * 检查内容是否包含报告结构（作为备用完成判断）
 */
function containsReportStructure(content: string): boolean {
  // 检查是否包含报告的典型结构
  const markers = [
    '## 总结',
    '## Summary',
    '### 严重问题',
    '### 建议改进',
    '# Code Review',
    '# Code Review Report',
  ];
  return markers.some(marker => content.includes(marker));
}
```

#### 2.3 修改后的 Loop 终止逻辑

```typescript
// loop.ts 修改

// 当 AI 返回 message (无 tool_calls) 时：
if (stepResult.type === 'message') {
  const content = stepResult.content || '';
  const phase = detectPhase(content);

  if (phase === 'complete') {
    // AI 宣布完成，终止 loop
    hasToolCalls = false;
  } else if (phase === 'unknown') {
    // 有内容但无明确阶段
    if (content.length > 200 && containsReportStructure(content)) {
      // 内容较长且包含报告结构，视为完成
      hasToolCalls = false;
    } else {
      // 可能是中间分析或短响应，继续等待
      hasToolCalls = true;
    }
  } else {
    // collecting 或 analyzing，继续循环
    hasToolCalls = true;
  }

  // 添加 assistant message
  messages.push({
    role: 'assistant',
    content: content,
  });
}
```

#### 2.4 事件增强

```typescript
// 新增事件
events.emit('loop:phase', { phase }); // AI 声明的阶段
events.emit('loop:waiting', { reason: 'intermediate' }); // 等待原因
```

---

### 第三部分：文件输出

#### 3.1 报告文件命名

```
reviews/
├── 2026-03-28-commit-6e17576.md
├── 2026-03-28-branch-feature.md
└── 2026-03-28-pr-12.md
```

#### 3.2 报告文件内容

直接使用 AI 输出的完整报告（包含标记），不做额外处理。

---

## 实现任务

### 任务 1：更新 System Prompt

**文件**: `prompts/system.md`

- 添加阶段声明系统
- 添加环境探索鼓励
- 添加完成声明要求
- 更新输出规范

### 任务 2：修改 Loop 检测逻辑

**文件**: `simple-agent/src/agent/loop.ts`

- 添加 `detectPhase()` 函数
- 添加 `containsReportStructure()` 函数
- 修改 message 处理逻辑，使用阶段检测

### 任务 3：添加 Loop 事件

**文件**: `simple-agent/src/agent/loop.ts`

- 添加 `loop:phase` 事件
- 添加 `loop:waiting` 事件

### 任务 4：测试验证

**测试场景**:

1. `review commit 6e17576` - 应该能完整收集文件并输出报告
2. `review 当前 branch 新代码` - 应该能正确探索环境
3. `review PR 12` - 应该能获取 PR 信息并分析

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| AI 不遵守阶段标记格式 | 先用方案 1（纯 prompt）测试，如果 AI 不遵守再加强制 |
| 误判中间分析为完成 | 使用多条件判断：标记 + 内容结构 |
| 路径探索导致过多迭代 | 设置 maxIterations=10 作为上限 |

---

## 成功标准

1. AI 在真正读取文件后才输出分析
2. Loop 不会在信息收集阶段提前终止
3. 最终报告包含完整的代码审查内容
4. 报告正确保存到 `reviews/` 目录
