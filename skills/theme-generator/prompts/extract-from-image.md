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
    },
  },
}
```
