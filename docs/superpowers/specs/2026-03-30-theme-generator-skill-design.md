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

## 核心模块设计

### 1. 输入处理器 (Input Handler)
- 解析用户输入类型（URL/图片/描述）
- 调用对应的提取逻辑
- 验证输入有效性

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
- 提供 Tailwind Config 转换说明
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
