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
  --color-secondary: #xxxxxx;
  --color-accent: #xxxxxx;
  --color-background: #xxxxxx;
  --color-surface: #xxxxxx;
  --color-text-primary: #xxxxxx;
  --color-text-secondary: #xxxxxx;
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
- 边框: [边框使用情况]
- 动效: [动效风格描述]

## 风格关键词
[3-5 个风格关键词]

## 变体建议
### Dark 版本
[深色主题调整]

### Light 版本
[浅色主题调整]

## Tailwind Config 转换参考
\`\`\`javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#xxxxxx',
        secondary: '#xxxxxx',
        accent: '#xxxxxx',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
}
\`\`\`
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
```

---

## Task 3: 创建 prompts/extract-from-url.md

**Files:**
- Create: `skills/theme-generator/prompts/extract-from-url.md`

**参考设计文档**: `prompts/extract-from-url.md 草案内容`

- [ ] **Step 1: 创建 extract-from-url.md**

```markdown
# URL 风格提取 Prompt

你是一个专业的网站样式分析师。请分析以下网页的视觉风格特征。

## URL

{user_provided_url}

## 任务

1. 使用 Playwright MCP 导航到该 URL
2. 等待页面完全加载（等待 networkidle 状态）
3. 截图保存到临时文件
4. 获取页面的 computed styles，分析以下要素：
   - 主色调、辅色调、强调色
   - 背景色、文字色（主、次）
   - 字体族、字号分布
   - 间距规律
   - 圆角、阴影使用
   - 整体风格关键词

## 输出格式

请以结构化 Markdown 格式输出：

```markdown
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
  --color-secondary: #xxxxxx;
  --color-accent: #xxxxxx;
  --color-background: #xxxxxx;
  --color-surface: #xxxxxx;
  --color-text-primary: #xxxxxx;
  --color-text-secondary: #xxxxxx;
}
\`\`\`

## 排版系统
- 字体族: xxx, xxx, xxx
- 字号层级: [列出使用的字号]
- 行高: xxx (正文), xxx (标题)

## 间距系统
- 基础单位: xpx
- 常用间距: [列出主要间距值]

## 装饰要素
- 圆角: [列出圆角值]
- 阴影: [列出阴影样式]
- 边框: [边框使用情况]
- 动效: [动效风格描述]

## 风格关键词
[扁平化/拟物/极简/大胆/柔和等]

## 变体建议
### Dark 版本
[深色主题调整]

### Light 版本
[浅色主题调整]

## Tailwind Config 转换参考
\`\`\`javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#xxxxxx',
        secondary: '#xxxxxx',
        accent: '#xxxxxx',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
}
\`\`\`
```

请确保分析准确，色彩值使用真实提取的 HEX 值。
```

---

## Task 4: 创建 prompts/extract-from-image.md

**Files:**
- Create: `skills/theme-generator/prompts/extract-from-image.md`

**参考设计文档**: `prompts/extract-from-image.md 草案内容`

- [ ] **Step 1: 创建 extract-from-image.md**

```markdown
# 图片风格提取 Prompt

你是一个专业的设计风格分析师。请分析以下图片中的视觉风格特征。

## 图片

{user_provided_image_description_or_base64}

## 任务

仔细观察图片，分析以下视觉要素：

1. **色彩系统**
   - 主色调是什么？
   - 辅色调和强调色？
   - 背景色和文字色对比度如何？
   - 是否是深色主题还是浅色主题？

2. **排版系统**
   - 字体风格（衬线/无衬线/等宽）？
   - 字号层级是否清晰？
   - 行高设置？

3. **间距系统**
   - 元素之间的间距是否统一？
   - 基础间距单位是多少？

4. **装饰要素**
   - 圆角使用情况（无圆角/小圆角/大圆角）？
   - 阴影使用（无阴影/柔和阴影/强阴影）？
   - 边框使用？

5. **整体风格**
   - 用 3-5 个关键词描述整体风格

## 输出格式

```markdown
## 色彩系统
- Primary: #xxxxxx [基于图片推断]
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
  --color-secondary: #xxxxxx;
  --color-accent: #xxxxxx;
  --color-background: #xxxxxx;
  --color-surface: #xxxxxx;
  --color-text-primary: #xxxxxx;
  --color-text-secondary: #xxxxxx;
}
\`\`\`

## 排版系统
- 字体族: [推断的字体]
- 字号层级: [估算的字号]
- 行高: [估算的行高]

## 间距系统
- 基础单位: xpx [估算]
- 常用间距: [估算的间距]

## 装饰要素
- 圆角: [观察到的圆角]
- 阴影: [观察到的阴影]
- 边框: [边框使用情况]
- 动效: [动效风格描述]

## 风格关键词
[3-5 个风格关键词]

## 变体建议
### Dark 版本
[深色主题调整]

### Light 版本
[浅色主题调整]

## Tailwind Config 转换参考
\`\`\`javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#xxxxxx',
        secondary: '#xxxxxx',
        accent: '#xxxxxx',
      },
    },
  },
}
\`\`\`
```
```

---

## Task 5: 创建 prompts/extract-from-description.md

**Files:**
- Create: `skills/theme-generator/prompts/extract-from-description.md`

**参考设计文档**: `prompts/extract-from-description.md 草案内容`

- [ ] **Step 1: 创建 extract-from-description.md**

```markdown
# 描述风格转换 Prompt

你是一个设计系统专家。请将用户的自然语言风格描述转化为结构化的主题规范。

## 用户描述

{user_provided_description}

## 示例描述

- "现代简约的深色主题，带有霓虹蓝的强调色"
- "温暖的咖啡色调，适合阅读的排版"
- "科技感的深蓝渐变主题"
- "Material Design 风格的明亮主题"

## 任务

1. 理解用户描述的风格意图
2. 推断合理的色彩搭配
3. 选择适合的字体和排版
4. 设定合适的间距和装饰要素
5. 生成 dark/light 双版本建议

## 输出格式

```markdown
## 推断的色彩系统
基于描述推断的配色方案：

- Primary: #xxxxxx [推断的主色]
- Secondary: #xxxxxx [推断的辅色]
- Accent: #xxxxxx [推断的强调色]
- Background: #xxxxxx [推断的背景色]
- Surface: #xxxxxx [推断的卡片/容器色]
- Text Primary: #xxxxxx [推断的主要文字色]
- Text Secondary: #xxxxxx [推断的次要文字色]

## CSS 变量模板
\`\`\`css
:root {
  --color-primary: #xxxxxx;
  --color-secondary: #xxxxxx;
  --color-accent: #xxxxxx;
  --color-background: #xxxxxx;
  --color-surface: #xxxxxx;
  --color-text-primary: #xxxxxx;
  --color-text-secondary: #xxxxxx;

  --font-family: [推荐字体];
  --font-size-base: 1rem;
  --line-height-normal: 1.5;

  --spacing-unit: 4px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}
\`\`\`

## 推断的排版系统
- 字体族: [推荐字体]
- 字号层级: [推荐层级]
- 行高: [推荐行高]

## 推断的间距系统
- 基础单位: xpx [推荐]
- 常用间距: [推荐间距]

## 推断的装饰要素
- 圆角: [推荐圆角]
- 阴影: [推荐阴影风格]
- 边框: [边框使用建议]
- 动效: [动效风格描述]

## 风格关键词
[从描述中提取的关键词]

## 变体建议
### Dark 版本
[深色主题的色彩调整建议]

### Light 版本
[浅色主题的色彩调整建议]

## Tailwind Config 转换参考
\`\`\`javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#xxxxxx',
        secondary: '#xxxxxx',
        accent: '#xxxxxx',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
}
\`\`\`
```

---

## Task 6: 创建 examples/sample-output.md

**Files:**
- Create: `skills/theme-generator/examples/sample-output.md`

**参考设计文档**: `examples/sample-output.md 草案内容`

- [ ] **Step 1: 创建 sample-output.md**

```markdown
# Theme Generator 输出示例

## 输入示例 1: URL

**URL:** https://tailwindcss.com

**输出:**

# Theme: Tailwind CSS 官网风格

## 色彩系统
- Primary: #38BDF8 (天蓝色)
- Secondary: #818CF8 (紫蓝色)
- Accent: #FBBF24 (金黄色)
- Background: #0F172A (深蓝黑色)
- Surface: #1E293B (深蓝灰)
- Text Primary: #F8FAFC (近白色)
- Text Secondary: #94A3B8 (灰蓝色)

## CSS 变量模板
\`\`\`css
:root {
  --color-primary: #38BDF8;
  --color-secondary: #818CF8;
  --color-accent: #FBBF24;
  --color-background: #0F172A;
  --color-surface: #1E293B;
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #94A3B8;

  --font-family: Inter, system-ui, sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --font-size-4xl: 2.25rem;

  --spacing-unit: 4px;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-12: 3rem;
  --spacing-16: 4rem;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
}

/* Light Theme Variant */
.theme-light {
  --color-background: #FFFFFF;
  --color-surface: #F1F5F9;
  --color-text-primary: #0F172A;
  --color-text-secondary: #64748B;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}
\`\`\`

## 排版系统
- 字体族: Inter, system-ui, sans-serif
- 字号层级: 14/16/18/20/24/30/36px
- 行高: 1.5 (正文), 1.2 (标题)

## 间距系统
- 基础单位: 4px
- 常用间距: 4/8/12/16/24/32/48/64px

## 装饰要素
- 圆角: 4px (小), 6px (中), 8px (大)
- 阴影: 深色柔和阴影
- 边框: 细边框
- 动效: 快速过渡

## 风格关键词
科技感、现代、深色优先、简洁、功能性强

## 变体建议
### Dark 版本
保持主色调，背景改为深色

### Light 版本
背景改为浅色，表面改为白色

## Tailwind Config 转换参考
\`\`\`javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#38BDF8',
        secondary: '#818CF8',
        accent: '#FBBF24',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
      },
    },
  },
}
\`\`\`
```

---

## 输入示例 2: 描述

**描述:** "现代简约的深色主题，带有霓虹蓝的强调色"

**输出:**

# Theme: 霓虹蓝深色主题

## 推断的色彩系统
- Primary: #00D4FF (霓虹蓝)
- Secondary: #6366F1 (靛蓝)
- Accent: #00D4FF (霓虹蓝强调)
- Background: #0A0A0F (深黑)
- Surface: #1A1A2E (深紫灰)
- Text Primary: #FFFFFF (白色)
- Text Secondary: #A0AEC0 (灰蓝)

## CSS 变量模板
\`\`\`css
:root {
  --color-primary: #00D4FF;
  --color-secondary: #6366F1;
  --color-accent: #00D4FF;
  --color-background: #0A0A0F;
  --color-surface: #1A1A2E;
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #A0AEC0;

  --font-family: Inter, system-ui, sans-serif;
  --font-size-base: 1rem;
  --line-height-normal: 1.5;

  --spacing-unit: 4px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --shadow-sm: 0 0 10px rgba(0, 212, 255, 0.2);
  --shadow-md: 0 0 20px rgba(0, 212, 255, 0.3);
  --shadow-glow: 0 0 40px rgba(0, 212, 255, 0.4);
}

/* Light Theme Variant */
.theme-light {
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-text-primary: #0A0A0F;
  --color-text-secondary: #64748B;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}
\`\`\`

## 推断的排版系统
- 字体族: Inter, system-ui, sans-serif
- 字号层级: 12/14/16/18/20/24/30/36/48px
- 行高: 1.5 (正文), 1.2 (标题)

## 推断的间距系统
- 基础单位: 4px
- 常用间距: 4/8/12/16/24/32/48/96px

## 推断的装饰要素
- 圆角: 小:4px, 中:8px, 大:12px
- 阴影: 霓虹发光效果
- 边框: 细边框或无边框
- 动效: 霓虹闪烁、柔和渐变

## 风格关键词
科技感、未来风、霓虹、深色、简约、现代

## 变体建议
### Dark 版本
保持霓虹蓝主色调，深色背景

### Light 版本
背景改为浅色，移除 glow 效果

## Tailwind Config 转换参考
\`\`\`javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#00D4FF',
        secondary: '#6366F1',
        accent: '#00D4FF',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
    },
  },
}
\`\`\`
```

---

## Task 7: Git 提交

**Files:**
- Create: `skills/theme-generator/skill.md`
- Create: `skills/theme-generator/prompts/extract-from-url.md`
- Create: `skills/theme-generator/prompts/extract-from-image.md`
- Create: `skills/theme-generator/prompts/extract-from-description.md`
- Create: `skills/theme-generator/examples/sample-output.md`

- [ ] **Step 1: 验证所有文件已创建**

```bash
ls -la skills/theme-generator/
ls -la skills/theme-generator/prompts/
ls -la skills/theme-generator/examples/
```

- [ ] **Step 2: 添加并提交**

```bash
git add skills/
git commit -m "feat: add theme-generator skill

Add skill that extracts design styles from URLs, images, or
descriptions and generates structured theme prompts with:
- CSS variables template
- Dark/light theme variants
- Tailwind Config conversion reference

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 3: 验证提交**

```bash
git log -1 --stat
```
