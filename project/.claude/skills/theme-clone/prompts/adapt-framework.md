# Adapt Design to Framework

## Objective

将提取的设计 Token 转换为目标项目框架所需的格式，并原地修改项目文件。

## Input

- 设计 Token（从 extract-from-url.md 获得）
- 目标项目路径
- 检测到的框架类型

## Process

### 1. 加载框架规则

读取 `.claude/skills/theme-clone/config/framework-rules.json` 获取目标框架的变量映射规则。

### 2. 框架检测（确认）

检查项目目录，确认框架类型：

| 框架 | 检测文件 |
|------|----------|
| Tailwind v4 | tailwind.config.js + @theme in globals.css |
| Tailwind v3 | tailwind.config.js + module.exports |
| shadcn/ui | components/ui + globals.css + lib/utils.ts |
| CSS Modules | *.module.css |
| Material UI | createTheme + @mui/material |

如果检测结果与用户确认不一致，提示用户选择。

### 3. 变量映射

根据框架类型，转换 Token：

**Tailwind v4 示例：**
```css
@theme {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --font-sans: "Inter", system-ui, sans-serif;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

**shadcn/ui 示例：**
```css
:root {
  --primary: 217.2 91.2% 59.8%;
  --secondary: 215 20.2% 65.1%;
  --radius: 0.5rem;
}
```

**Tailwind v3 (tailwind.config.js)：**
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b'
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px'
      }
    }
  }
}
```

### 4. 文件修改

修改以下目标文件（按框架类型选择）：

| 框架 | 目标文件 |
|------|----------|
| Tailwind v4 | globals.css, tailwind.config.js |
| Tailwind v3 | tailwind.config.js |
| shadcn/ui | app/globals.css, components.json |
| CSS Modules | 对应的 .module.css 文件 |

**修改原则：**
- 只追加，不删除现有样式
- 使用清晰的注释标记新增内容
- 保留原文件的格式和缩进

### 5. 预览生成

生成修改后的文件预览，展示将做出的变更：

```
## 将修改的文件

1. **globals.css** (+15 行)
   ```css
   /* === Theme Clone: Extracted from https://example.com === */
   @theme {
     --color-primary: #3b82f6;
     ...
   }
   /* === End Theme Clone === */
   ```

2. **tailwind.config.js** (+8 行)
   ```javascript
   // Theme Clone additions
   ...
   ```

## 注意事项

- 如果项目使用 CSS 变量，确保变量名不与现有冲突
- 对于 OKLCH 格式，确保目标框架支持（Tailwind v4 原生支持）
- 备份建议：提示用户提交前确认 git 状态
