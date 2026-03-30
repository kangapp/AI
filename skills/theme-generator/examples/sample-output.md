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
```css
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
```

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
```javascript
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
```
