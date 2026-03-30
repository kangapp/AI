# Theme Generator Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 theme-generator skill，支持从 URL、图片或描述中提取网站风格，生成结构化主题 prompt

**Architecture:** Skill 是纯 Markdown 文件，包含 YAML frontmatter 和完整指令。风格提取逻辑通过 prompt 模板实现，使用 Playwright MCP 进行 URL 抓取。

**Tech Stack:** Markdown, Playwright MCP

---

## 文件结构

```
AI/
├── docs/superpowers/plans/
│   └── 2026-03-30-theme-generator-skill-implementation.md
└── skills/
    └── theme-generator/
        ├── skill.md                    # 主 Skill 文件
        ├── prompts/
        │   ├── extract-from-url.md     # URL 提取 prompt
        │   ├── extract-from-image.md   # 图片提取 prompt
        │   └── extract-from-description.md  # 描述提取 prompt
        └── examples/
            └── sample-output.md        # 输出示例
```

---

## Task 1: 创建目录结构

**Files:**
- Create: `skills/theme-generator/prompts/`
- Create: `skills/theme-generator/examples/`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p skills/theme-generator/prompts
mkdir -p skills/theme-generator/examples
```

- [ ] **Step 2: 验证目录创建**

```bash
ls -la skills/theme-generator/
ls -la skills/theme-generator/prompts/
ls -la skills/theme-generator/examples/
```

---

## Task 2: 创建 skill.md 主文件

**Files:**
- Create: `skills/theme-generator/skill.md`

- [ ] **Step 1: 创建 skill.md**

```markdown
---
name: theme-generator
description: 从 URL、图片或描述中提取网站风格，生成主题 CSS prompt。当用户请求"提取网站风格"、"生成主题"、"分析设计样式"、"创建设计系统"时使用此 skill。
---

# Theme Generator Skill

## Objective

帮助用户从任意网站、图片或描述中提取风格特征，生成结构化的主题描述 Prompt，可用于 Claude、Midjourney、Figma AI 等多种 AI 工具生成 CSS 或 UI 设计。

## Input Types

用户可以选择以下三种输入方式之一：

### 1. URL 输入
用户提供网站 URL，skill 使用 Playwright MCP 抓取页面并分析样式。

### 2. 图片输入
用户上传截图或设计稿图片，skill 分析图片中的视觉要素。

### 3. 描述输入
用户通过自然语言描述想要的风格。

## Workflow

### 步骤 1: 询问输入类型

当用户调用此 skill 时，先询问用户选择哪种输入方式：

> "请选择风格提取的输入方式：
> **A) URL** - 提供网站地址，我将抓取并分析
> **B) 图片** - 上传截图或设计稿
> **C) 描述** - 用文字描述你想要的风格"

### 步骤 2: 根据用户选择处理

**A) URL 模式:**
1. 获取用户提供的 URL
2. 使用 Playwright MCP 导航到该 URL
3. 等待页面完全加载（networkidle）
4. 截图
5. 获取 computed styles
6. 调用 `prompts/extract-from-url.md` 中的 prompt 进行分析
7. 生成结构化 theme prompt

**B) 图片模式:**
1. 获取用户上传的图片
2. 调用 `prompts/extract-from-image.md` 中的 prompt 进行分析
3. 生成结构化 theme prompt

**C) 描述模式:**
1. 获取用户描述的风格偏好
2. 调用 `prompts/extract-from-description.md` 中的 prompt 进行分析
3. 生成结构化 theme prompt

### 步骤 3: 输出结构化 Theme Prompt

生成的 prompt 包含：
- 色彩系统（Primary, Secondary, Accent, Background, Surface, Text Primary, Text Secondary）
- 排版系统（字体族、字号层级、行高）
- 间距系统（基础单位、常用间距）
- 装饰要素（圆角、阴影、边框）
- CSS 变量模板代码
- dark/light 主题变体建议
- Tailwind Config 转换参考

### 步骤 4: 提供使用说明

告知用户如何使用生成的 prompt：
> "已将风格提取为结构化 prompt，你可以：
> - 将此 prompt 发送给 Claude 生成完整 CSS
> - 将此 prompt 用于 Midjourney 生成设计稿
> - 将 CSS 变量直接集成到你的项目中"

## Output Format

生成的 Theme Prompt 格式：

```markdown
# Theme: [主题名称]

## 色彩系统
- Primary: #xxxxxx
- Secondary: #xxxxxx
- Accent: #xxxxxx
- Background: #xxxxxx
- Surface: #xxxxxx
- Text Primary: #xxxxxx
- Text Secondary: #xxxxxx

## CSS 变量模板
\`\`\`css
:root {
  --color-primary: #xxxxxx;
  /* ... */
}
\`\`\`

## 排版系统
- 字体族: xxx, xxx, xxx
- 字号层级: [层级列表]
- 行高: xxx (正文), xxx (标题)

## 间距系统
- 基础单位: xpx
- 常用间距: [间距列表]

## 装饰要素
- 圆角: [圆角值]
- 阴影: [阴影样式]

## 风格关键词
[3-5 个风格关键词]

## 变体建议
### Dark 版本
[深色主题调整]

### Light 版本
[浅色主题调整]
```

## Error Handling

| 错误场景 | 处理方式 |
|---------|---------|
| URL 无法访问 | 提示用户检查 URL，询问是否尝试其他输入方式 |
| URL 需要登录/CAPTCHA | 提示用户该页面需要认证，建议使用截图方式 |
| 图片格式不支持 | 提示支持的格式（PNG、JPG、WebP），请用户转换后重试 |
| 页面加载超时 | 等待 30 秒后重试一次，仍失败则提示用户 |
| 描述过于模糊 | 追问关键要素（颜色倾向、风格关键词、应用场景） |

## Edge Cases

| 场景 | 处理方式 |
|------|---------|
| 深色/浅色主题混合页面 | 提取主要主题，标注混合情况 |
| 动态内容网站 (SPA) | 尝试等待关键元素加载，或提示用户使用截图 |
| 移动端和桌面端差异 | 默认抓取桌面版，提示用户如需移动版请提供截图 |
| 不支持的图片格式 | 提示用户转换为 PNG、JPG 或 WebP |
| 图片文件过大 | 建议压缩到 5MB 以下 |
| 用户描述非常模糊 | 追问 2-3 个关键问题缩小范围 |
| URL 是本地文件 | 不支持，提示使用其他输入方式 |
| 页面使用 CSS 变量切换主题 | 尝试检测并提取 dark/light 两种变体 |

## Usage

用户可以通过以下方式调用：
- `/theme-generator`
- `使用 theme-generator skill`
- `提取网站风格`
- `生成主题`
