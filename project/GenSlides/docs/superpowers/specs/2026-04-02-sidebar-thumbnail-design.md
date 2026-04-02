# 侧边栏缩略图 + Slide 编辑弹窗 设计规格

> **目标：** 增强编辑页面侧边栏，提供缩略图和标题显示；双击打开编辑弹窗支持修改文本、生成图片、选择展示图。

## 架构概述

在现有编辑页面基础上：
1. **侧边栏 SlideItem** - 显示缩略图 + 标题（AI 提取或文本截取）
2. **编辑弹窗 (SlideEditModal)** - 编辑文本 + 生成多张图片 + 选择展示图
3. **后端** - 新增标题提取 API

## 数据模型变更

### 前端 types.ts

```typescript
interface Slide {
  sid: string;
  text: string;           // 完整文本
  title?: string;        // AI 提取的标题
  thumbnail?: string;     // 该 slide 的展示图 URL
  created_at: string;
}
```

### 后端 models.py

```python
class Slide(SlideBase):
    sid: str
    title: Optional[str] = None   # 新增
    thumbnail: Optional[str] = None # 新增
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

## 后端 API

### 1. 提取标题 API

**POST `/api/projects/{slug}/slides/{sid}/extract-title`**

Request:
```json
{
  "text": "用户在 slide 中输入的完整文本"
}
```

Response:
```json
{
  "title": "AI 提取的简短标题"
}
```

实现：调用 LLM (如 Gemini) 从文本提取 10-20 字标题。

### 2. 更新 Slide API

**PUT `/api/projects/{slug}/slides/{sid}`**

Request:
```json
{
  "text": "更新后的文本",
  "title": "可选的标题",
  "thumbnail": "可选的展示图路径"
}
```

### 3. 获取 Slide 详情 API

**GET `/api/projects/{slug}/slides/{sid}`**

Response:
```json
{
  "sid": "...",
  "text": "...",
  "title": "...",
  "thumbnail": "...",
  "created_at": "..."
}
```

## 前端组件

### 1. SlideItem (侧边栏单项)

**位置：** `src/components/SlideItem.tsx`

**功能：**
- 显示缩略图 (64x36, 16:9)
- 显示标题 (title 字段或 text 前30字符)
- 显示"已生成"标签 (如有缩略图)

**UI 布局：**
```
┌─────────────────────────────────┐
│ [缩略图 64x36]  标题文字        │
│                 ● 已生成        │
└─────────────────────────────────┘
```

**交互：**
- 单击：选中该 slide
- 双击：打开 SlideEditModal

### 2. SlideEditModal (编辑弹窗)

**位置：** `src/components/SlideEditModal.tsx`

**Props:**
```typescript
interface SlideEditModalProps {
  slide: Slide;
  projectSlug: string;
  onClose: () => void;
  onSave: (updatedSlide: Slide) => void;
}
```

**UI 布局：**
```
┌────────────────────────────────────────────┐
│  编辑 Slide                            [×]  │
├────────────────────────────────────────────┤
│  Provider:  [MiniMax ▼]                   │
│                                            │
│  文本内容:                                  │
│  ┌──────────────────────────────────────┐  │
│  │ textarea 编辑区                      │  │
│  └──────────────────────────────────────┘  │
│  [提取标题]                                │
│                                            │
│  ─────────────────────────────────────────  │
│                                            │
│  图片生成:                                  │
│  [生成 2 张图片]                           │
│                                            │
│  ┌────────┐  ┌────────┐                   │
│  │ 图片1  │  │ 图片2  │  (点击选择)      │
│  │  ○ 选中 │  │        │                   │
│  └────────┘  └────────┘                   │
│                                            │
│              [取消]  [确认保存]             │
└────────────────────────────────────────────┘
```

**状态机：**
- `idle` - 初始状态，显示当前数据
- `extracting` - 提取标题中
- `generating` - 生成图片中 (显示 loading)
- `selecting` - 图片生成完成，等待选择
- `saving` - 保存中

**交互流程：**
1. 打开弹窗 → 显示当前文本和已有缩略图
2. 用户编辑文本
3. 点击"提取标题" → 调用 API → 更新标题显示
4. 点击"生成 2 张图片" → 使用当前选择的 provider 生成
5. 图片生成完成 → 显示 2 张图，点击选择
6. 点击"确认保存" → 更新 slide 数据，关闭弹窗

### 3. Sidebar 更新

**变更：**
- 接收新的 Slide 类型 (含 title, thumbnail)
- 布局可能需要调整以适应缩略图

## 缩略图显示逻辑

```typescript
function getSlideThumbnail(slide: Slide): string | null {
  // 优先使用 thumbnail
  if (slide.thumbnail) {
    return slide.thumbnail;
  }
  // 否则使用第一张生成的图片
  const images = imagesStore[slide.sid];
  return images?.[0]?.url ?? null;
}
```

## 核心流程

```
用户双击 SlideItem
    → 打开 SlideEditModal (显示当前文本 + 已有缩略图)
    → 用户编辑文本
    → 用户点击"提取标题" (可选)
    → 用户点击"生成 2 张图片"
    → 系统使用当前 provider 生成 2 张图片
    → 用户点击选择一张
    → 用户点击"确认保存"
    → 调用 PUT API 更新 slide
    → 关闭弹窗
    → 侧边栏更新显示缩略图 + 标题
```

## 样式考虑

遵循当前 MotherDuck 主题：
- 弹窗背景：白色 + 硬阴影
- 按钮：黄色主色调
- 输入框：浅色背景 + 圆角
- 缩略图：圆角卡片

## 待确认

1. 标题字符限制？(建议 20-30 字)
2. 提取标题的 prompt 设计？
3. 是否需要支持手动输入标题？(而非仅 AI 提取)
