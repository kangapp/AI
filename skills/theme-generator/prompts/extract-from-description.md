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
```css
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
```

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
```javascript
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
```
