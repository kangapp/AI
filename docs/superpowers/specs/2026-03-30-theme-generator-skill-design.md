# Theme Generator Skill 设计文档

## 概述

**Skill 名称**: `theme-generator`

**功能**: 从 URL、图片或描述中提取网站/设计的风格特征，生成结构化的主题描述 Prompt，可用于 Claude、Midjourney、Figma AI 等多种 AI 工具生成 CSS 或 UI 设计。

**目标用户**: 前端开发者、设计师、需要快速创建主题的开发者。

---

## 输入方式

### 1. URL 抓取（使用 Playwright MCP）
- 用户提供网站 URL
- Playwright MCP 导航到页面截图
- 分析页面 computed styles（颜色、字体、间距）
- 提取关键视觉要素

### 2. 图片分析
- 用户上传截图/设计稿
- AI 分析配色、布局、装饰要素
- 生成结构化描述

### 3. 描述输入
- 用户通过自然语言描述风格偏好
- 如："现代简约的深色主题，带有霓虹蓝的强调色"
- AI 将描述转化为结构化的 theme prompt

---

## 输出格式：CSS 变量 + 多主题类名

```css
:root {
  /* 色彩系统 */
  --color-primary: #3B82F6;
  --color-secondary: #8B5CF6;
  --color-accent: #F59E0B;
  --color-background: #FFFFFF;
  --color-surface: #F3F4F6;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;

  /* 排版系统 */
  --font-family: Inter, system-ui, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;

  /* 间距系统 */
  --spacing-unit: 4px;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-12: 3rem;
  --spacing-16: 4rem;

  /* 装饰要素 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
}

/* 暗色主题 */
.theme-dark {
  --color-background: #0F172A;
  --color-surface: #1E293B;
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #94A3B8;
}
```

---

## 文件结构

```
AI/
├── docs/superpowers/specs/
│   └── 2026-03-30-theme-generator-skill-design.md
├── skills/
│   └── theme-generator/
│       ├── skill.md                    # 主 Skill 文件
│       ├── prompts/
│       │   ├── extract-from-url.md     # URL 提取 prompt
│       │   ├── extract-from-image.md   # 图片提取 prompt
│       │   └── extract-from-description.md  # 描述提取 prompt
│       └── examples/
│           └── sample-output.md        # 输出示例
```

---

## skill.md 草案内容

```yaml
---
name: theme-generator
description: 从 URL、图片或描述中提取网站风格，生成主题 CSS prompt。当用户请求"提取网站风格"、"生成主题"、"分析设计样式"、"创建设计系统"时使用此 skill。
---

# Theme Generator Skill

## Objective

帮助用户从任意网站、图片或描述中提取风格特征，生成结构化的主题描述 Prompt。

## Input Types

用户可以选择以下三种输入方式之一：

### 1. URL 输入
用户提供网站 URL，skill 使用 Playwright MCP 抓取页面并分析样式。

### 2. 图片输入
用户上传截图或设计稿图片，skill 分析图片中的视觉要素。

### 3. 描述输入
用户通过自然语言描述想要的风格。

## Output

生成结构化的 Markdown 格式 Theme Prompt，包含：
- 色彩系统（主色、辅色、强调色、背景色、文字色）
- 排版系统（字体族、字号层级、行高）
- 间距系统（基础单位、常用间距）
- 装饰要素（圆角、阴影、边框）
- CSS 变量模板代码
- dark/light 主题变体建议

## Error Handling

| 错误场景 | 处理方式 |
|---------|---------|
| URL 无法访问 | 提示用户检查 URL，询问是否尝试其他输入方式 |
| URL 需要登录/CAPTCHA | 提示用户该页面需要认证，建议使用截图方式 |
| 图片格式不支持 | 提示支持的格式（PNG、JPG、WebP），请用户转换后重试 |
| 页面加载超时 | 等待 30 秒后重试一次，仍失败则提示用户 |
| 描述过于模糊 | 追问关键要素（颜色倾向、风格关键词、应用场景） |

## Usage

用户调用时，询问输入类型并获取输入，然后调用对应 prompt 生成输出。
```

---

## prompts/extract-from-url.md 草案内容

```markdown
# URL 风格提取 Prompt

你是一个专业的网站样式分析师。请分析以下网页的视觉风格特征。

## URL
{user_provided_url}

## 任务

1. 使用 Playwright MCP 导航到该 URL
2. 等待页面完全加载（等待 networkidle 状态）
3. 截图保存
4. 获取页面的 computed styles，分析以下要素：
   - 主色调、辅色调、强调色
   - 背景色、文字色（主、次）
   - 字体族、字号分布
   - 间距规律
   - 圆角、阴影使用
   - 整体风格关键词

## 输出格式

请以结构化 Markdown 格式输出，参考以下模板：

```markdown
## 色彩系统
- Primary: #xxxxxx
- Secondary: #xxxxxx
- Accent: #xxxxxx
- Background: #xxxxxx
- Surface: #xxxxxx
- Text Primary: #xxxxxx
- Text Secondary: #xxxxxx

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
- 其他: [边框、动效等]

## 风格关键词
[扁平化/拟物/极简/大胆/柔和等]
```

请确保分析准确，色彩值使用真实提取的值。
```

---

## prompts/extract-from-image.md 草案内容

```markdown
# 图片风格提取 Prompt

你是一个专业的设计风格分析师。请分析以下图片中的视觉风格特征。

## 图片
{user_provided_image}

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
- Primary: #xxxxxx
- Secondary: #xxxxxx
- Accent: #xxxxxx
- Background: #xxxxxx
- Surface: #xxxxxx
- Text Primary: #xxxxxx
- Text Secondary: #xxxxxx

## 排版系统
- 字体族: xxx, xxx, xxx
- 字号层级: [列出估算的字号]
- 行高: xxx (正文), xxx (标题)

## 间距系统
- 基础单位: xpx
- 常用间距: [列出估算的间距值]

## 装饰要素
- 圆角: [列出观察到的圆角值]
- 阴影: [列出观察到的阴影样式]
- 其他: [边框、动效等]

## 风格关键词
[扁平化/拟物/极简/大胆/柔和等]
```
```

---

## prompts/extract-from-description.md 草案内容

```markdown
# 描述风格转换 Prompt

你是一个设计系统专家。请将用户的自然语言风格描述转化为结构化的主题规范。

## 用户描述
{user_provided_description}

## 示例描述
- "现代简约的深色主题，带有霓虹蓝的强调色"
- "温暖的咖啡色调，适合阅读的排版"
- "科技感的深蓝渐变主题"

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

- Primary: #xxxxxx
- Secondary: #xxxxxx
- Accent: #xxxxxx
- Background: #xxxxxx
- Surface: #xxxxxx
- Text Primary: #xxxxxx
- Text Secondary: #xxxxxx

## 推断的排版系统
- 字体族: [推荐字体]
- 字号层级: [推荐层级]
- 行高: [推荐行高]

## 推断的间距系统
- 基础单位: xpx
- 常用间距: [推荐间距]

## 推断的装饰要素
- 圆角: [推荐圆角]
- 阴影: [推荐阴影]
- 其他: [推荐其他装饰]

## 风格关键词
[从描述中提取的关键词 + 补充]

## 变体建议
### Light 版本
[浅色主题的色彩调整建议]

### Dark 版本
[深色主题的色彩调整建议]
```
```

---

## examples/sample-output.md 草案内容

```markdown
# Theme Generator 输出示例

## 输入
URL: https://tailwindcss.com

## 输出

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
```css
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

  --spacing-unit: 4px;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
}

/* Light Theme Variant */
.theme-light {
  --color-background: #FFFFFF;
  --color-surface: #F1F5F9;
  --color-text-primary: #0F172A;
  --color-text-secondary: #64748B;
}
```

## 排版系统
- 字体族: Inter, system-ui, sans-serif
- 字号层级: 14/16/18/20/24/30/36px
- 行高: 1.5 (正文), 1.2 (标题)

## 间距系统
- 基础单位: 4px
- 常用间距: 4/8/12/16/24/32/48/64px

## 装饰要素
- 圆角: 4px (小), 6px (中), 8px (大)
- 阴影: 深色柔和阴影，适合深色背景
- 边框: 细边框，透明度较高

## 风格关键词
科技感、现代、深色优先、简洁、功能性强

## Tailwind Config 转换参考
```javascript
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
```
```

---

## 核心模块设计

### 1. 输入处理器 (Input Handler)
- 解析用户输入类型（URL/图片/描述）
- 验证输入有效性
- 调用对应的提取逻辑

### 2. 风格提取器 (Style Extractor)
- **URL 模式**: 使用 Playwright MCP 获取页面截图和 computed styles
- **图片模式**: AI 视觉分析提取颜色和布局
- **描述模式**: NLP 理解用户描述的关键要素

### 3. Prompt 生成器 (Prompt Generator)
- 将提取的风格特征转化为结构化 Markdown
- 生成包含以下部分的 prompt：
  - 色彩系统（主色、辅色、强调色、背景色、文字色）
  - 排版系统（字体族、字号层级、行高）
  - 间距系统（基础单位、常用间距）
  - 装饰要素（圆角、阴影、边框）
  - CSS 变量模板代码
  - 变体建议（dark/light 版本差异）

### 4. 多框架适配
- 输出通用 CSS 变量格式
- 提供 Tailwind Config 转换参考
- 提供 SCSS/Less 变量转换说明

---

## 使用流程

1. **用户调用**: `/theme-generator` 或 `使用 theme-generator skill`
2. **输入收集**: Skill 询问用户输入类型并获取输入
3. **风格提取**:
   - URL → Playwright MCP 抓取分析
   - 图片 → AI 视觉分析
   - 描述 → NLP 理解
4. **Prompt 生成**: 生成结构化 theme prompt
5. **用户使用**: 将 prompt 用于其他 AI 工具

---

## 技术依赖

- **Playwright MCP**: URL 抓取和页面样式提取
- **Claude AI**: 风格分析和 prompt 生成
- **前端框架知识**: CSS 变量、Tailwind、SCSS

---

## 错误处理 (Error Handling)

| 错误场景 | 处理方式 |
|---------|---------|
| URL 无法访问 | 提示用户检查 URL，询问是否尝试其他输入方式 |
| URL 需要登录/CAPTCHA | 提示用户该页面需要认证，建议使用截图方式 |
| 图片格式不支持 | 提示支持的格式（PNG、JPG、WebP），请用户转换后重试 |
| 页面加载超时 | 等待 30 秒后重试一次，仍失败则提示用户 |
| 描述过于模糊 | 追问关键要素（颜色倾向、风格关键词、应用场景） |

---

## 边界情况 (Edge Cases)

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

---

## 成功标准

1. 能从任意 URL 提取风格并生成可用 prompt
2. 能从截图/图片准确识别配色方案
3. 生成的 prompt 可直接被其他 AI 工具使用
4. 支持 dark/light 双主题输出
5. 输出的 CSS 变量可直接集成到任意前端项目

---

## 后续扩展方向（不包含在 MVP 中）

- 生成完整 CSS 文件（而非 prompt）
- 生成预览 HTML 页面
- 支持主题一键应用到现有项目
- 主题版本管理和切换
