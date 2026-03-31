# Extract Design from URL

## Objective

从目标 URL 提取完整的视觉设计元素，建立设计 Token 系统。

## Process

### 1. 访问目标 URL

使用 Playwright MCP 或 browser_navigate 工具访问用户提供的 URL。

```
browser_navigate
  url: <user-provided-url>
```

等待页面完全加载（networkidle 状态）。

### 2. 截图存档

使用 browser_take_screenshot 捕获页面截图，保存为 `theme-extraction-{timestamp}.png`。

### 3. 提取计算样式

执行以下 JavaScript 获取页面的计算样式：

```javascript
(function() {
  const results = {
    colors: [],
    typography: [],
    spacing: [],
    borderRadius: [],
    shadows: []
  };

  const elements = document.querySelectorAll('*');
  const seen = new Set();

  elements.forEach(el => {
    const style = window.getComputedStyle(el);

    // Extract colors
    ['backgroundColor', 'color', 'borderColor'].forEach(prop => {
      const val = style[prop];
      if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
        if (!seen.has(val)) {
          seen.add(val);
          results.colors.push({ value: val, type: prop });
        }
      }
    });

    // Extract typography
    const fontKey = `${style.fontFamily}-${style.fontWeight}`;
    if (!seen.has(fontKey)) {
      seen.add(fontKey);
      results.typography.push({
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight
      });
    }

    // Extract border-radius
    if (style.borderRadius !== '0px' && !seen.has(style.borderRadius)) {
      seen.add(style.borderRadius);
      results.borderRadius.push(style.borderRadius);
    }

    // Extract shadows
    if (style.boxShadow !== 'none' && !seen.has(style.boxShadow)) {
      seen.add(style.boxShadow);
      results.shadows.push(style.boxShadow);
    }
  });

  return results;
})()
```

### 4. 分析与聚类

使用 analyzer_extracted_data 函数分析提取结果：

- **主色识别**：选择出现频率最高的背景色或品牌色
- **色彩调色板**：聚类相似颜色，生成 5-10 色板
- **字体栈**：提取页面使用的字体族、字重、行高
- **间距系统**：从 margin/padding 推导 4px 或 8px 基准
- **圆角标度**：归纳所有唯一的 border-radius 值
- **阴影标度**：提取所有 box-shadow 值

> **注意**: 如果使用 `tools/extractor.js`，分析函数名为 `analyzeExtractedData`（驼峰命名）。

### 5. 输出格式

生成结构化的设计 Token：

```json
{
  "source": {
    "url": "<original-url>",
    "screenshot": "<screenshot-path>"
  },
  "colors": {
    "primary": "#3b82f6",
    "secondary": "#64748b",
    "palette": ["#3b82f6", "#1d4ed8", "#64748b", ...]
  },
  "typography": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "fontWeights": [400, 500, 600, 700],
    "lineHeights": ["1.2", "1.5", "1.75"]
  },
  "spacing": {
    "base": "4px",
    "scale": [4, 8, 12, 16, 24, 32, 48, 64]
  },
  "borderRadius": {
    "sm": "4px",
    "md": "8px",
    "lg": "12px"
  },
  "shadows": {
    "sm": "0 1px 2px rgba(0,0,0,0.05)",
    "md": "0 4px 6px rgba(0,0,0,0.1)"
  }
}
```

## 注意事项

- 只提取 `display: none` 以外的可见元素
- 忽略 `rgba(0,0,0,0)` 和 `transparent` 的透明色
- 字体优先使用 `fontFamily` 的第一个值（主字体）
- 颜色值优先保留原始格式（hex/rgb/hsl）
