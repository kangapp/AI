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
```css
:root {
  --color-primary: #xxxxxx;
  --color-secondary: #xxxxxx;
  --color-accent: #xxxxxx;
  --color-background: #xxxxxx;
  --color-surface: #xxxxxx;
  --color-text-primary: #xxxxxx;
  --color-text-secondary: #xxxxxx;
}
```

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
```

请确保分析准确，色彩值使用真实提取的 HEX 值。
