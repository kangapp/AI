# GenSlides 设计文档

## 1. 概述

**项目名称**: GenSlides
**类型**: 本地运行的单页 Web 应用
**核心功能**: 通过文字内容驱动 AI 生成幻灯片图片，支持全屏走马灯播放
**目标用户**: 需要快速生成视觉化演示内容的用户

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | TypeScript + Tailwind CSS + Zustand |
| 后端 | Python + FastAPI |
| 图片生成 | Gemini Nano Banana Pro / MiniMax Image API (用户可选) |
| 存储 | 本地文件系统 (YAML + JPEG) |
| 数据库 | 无 |

---

## 3. 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (TypeScript + Tailwind + Zustand) │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │ Sidebar  │  │ Preview  │  │  Thumbnail Strip         │  │
│  │ (Slide   │  │ (Main    │  │  (Generated Images)      │  │
│  │  List)   │  │  Image)  │  │                          │  │
│  └──────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端 (Python + FastAPI)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │ Slides   │  │ Image    │  │  Cost Tracker            │  │
│  │ Manager  │  │ Generator│  │                          │  │
│  └──────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    ┌──────────┐       ┌──────────┐       ┌──────────┐
    │ File     │       │ Gemini   │       │ MiniMax  │
    │ System   │       │ API      │       │ Image API│
    └──────────┘       └──────────┘       └──────────┘
```

---

## 4. 数据存储结构

### 4.1 目录结构

```
project/GenSlides/
├── slides/
│   └── <slug>/              # 项目/slide 集合
│       └── outline.yml      # 所有 slide 的文本内容
└── slides/images/
    └── <sid>/               # 每个 slide 的独立目录
        └── <blake3_hash>.jpg  # 根据文字内容 hash 命名的图片
```

### 4.2 outline.yml 结构

```yaml
title: "项目标题"
slides:
  - sid: "abc123"
    text: "这是第一张幻灯片的文字内容"
    created_at: "2026-04-01T10:00:00Z"
  - sid: "def456"
    text: "这是第二张幻灯片的文字内容"
    created_at: "2026-04-01T10:01:00Z"
```

### 4.3 图片命名规则

- 路径: `./slides/images/<sid>/<blake3_hash>.jpg`
- blake3_hash = blake3(text_content)
- 相同文字内容会生成相同的 hash，实现图片复用

---

## 5. 前端组件设计

| 组件 | 职责 |
|------|------|
| `App` | 根组件，布局容器 |
| `Header` | Logo、路径信息、播放按钮 |
| `Sidebar` | Slide 列表，支持创建、选择、删除 |
| `SlideEditor` | 双击编辑 slide 文字内容 |
| `SlideItem` | 单个 slide 项，支持点击选中 |
| `MainPreview` | 显示当前选中 slide 的主图 |
| `ThumbnailStrip` | 当前 slide 的多张生成图片 |
| `FullscreenPlayer` | 全屏走马灯播放模式 |

### 5.1 组件交互

1. **创建 Slide**: 点击侧边栏底部 "+" 按钮，创建空 slide
2. **选择 Slide**: 单击侧边栏 slide 项，选中并显示主图
3. **编辑文字**: 双击侧边栏 slide 项，进入编辑模式，Enter 确认
4. **生成图片**: 文字保存后自动检查本地缓存，无缓存则调用后端生成
5. **全屏播放**: 点击播放按钮，从当前选中 slide 开始全屏播放

---

## 6. 后端 API 设计

### 6.1 Slides 管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `GET /api/slides` | GET | 获取所有 slides |
| `POST /api/slides` | POST | 创建新 slide |
| `PUT /api/slides/{sid}` | PUT | 更新 slide 文字 |
| `DELETE /api/slides/{sid}` | DELETE | 删除 slide |

### 6.2 图片生成

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /api/slides/{sid}/generate` | POST | 触发图片生成 |
| `GET /api/slides/{sid}/images` | GET | 获取 slide 的图片列表 |
| `GET /api/images/{sid}/{hash}` | GET | 获取指定图片 |

### 6.3 播放与成本

| 端点 | 方法 | 说明 |
|------|------|------|
| `GET /api/cost` | GET | 获取当前会话成本统计 |
| `GET /api/playback/slides` | GET | 获取播放用的 slides 列表（含主图 URL） |

### 6.4 请求/响应示例

**POST /api/slides**
```json
// Request
{ "text": "这是新幻灯片的文字内容" }

// Response
{ "sid": "abc123", "text": "这是新幻灯片的文字内容", "created_at": "..." }
```

**POST /api/slides/{sid}/generate**
```json
// Request
{
  "provider": "gemini" | "minimax",
  "force": false  // 是否强制重新生成
}

// Response
{
  "sid": "abc123",
  "hash": "xyz789",
  "image_url": "/api/images/abc123/xyz789",
  "cached": false
}
```

---

## 7. 图片生成流程

```
用户输入文字
    │
    ▼
保存到 outline.yml
    │
    ▼
计算文字的 blake3 hash
    │
    ├─── 图片已存在? ──── 是 ──── 直接返回本地图片路径
    │                        │
    │                        ▼
    │                   返回 { cached: true }
    │
    ▼ (否)
调用选定的 AI API 生成图片
    │
    ├─── Gemini Nano Banana Pro
    └─── MiniMax Image API
    │
    ▼
保存图片到 ./slides/images/<sid>/<hash>.jpg
    │
    ▼
更新成本计数器
    │
    ▼
返回 { cached: false, image_url: "..." }
```

---

## 8. 全屏播放模式

- 打开全屏后，按顺序展示所有 slide 的主图
- 每张图片停留时间: 默认 5 秒（可配置）
- 键盘控制:
  - `←` / `→`: 上一张/下一张
  - `Space`: 暂停/继续
  - `ESC`: 退出全屏
- 退出全屏后返回原有选中状态

---

## 9. 成本追踪

### 9.1 追踪内容

- Gemini API 调用次数和估算成本
- MiniMax API 调用次数和估算成本
- 当前会话总成本
- 每个 slide 的生成成本

### 9.2 显示位置

- 页面底部信息栏
- 展示格式: "Gemini: $0.00 | MiniMax: $0.00 | Total: $0.00"

---

## 10. 项目结构

```
project/GenSlides/
├── backend/
│   ├── main.py              # FastAPI 入口
│   ├── slides_manager.py    # Slides CRUD
│   ├── image_generator.py   # AI API 调用
│   ├── cost_tracker.py      # 成本追踪
│   └── models.py            # Pydantic 模型
├── frontend/
│   ├── index.html           # 入口 HTML
│   ├── src/
│   │   ├── main.ts          # 应用入口
│   │   ├── App.tsx          # 根组件
│   │   ├── components/      # UI 组件
│   │   ├── stores/          # Zustand stores
│   │   └── api.ts           # 后端 API 客户端
│   └── package.json
├── slides/                  # 运行时数据
├── docs/                    # 文档
│   └── superpowers/
│       └── specs/
├── package.json             # 根目录 package.json (前端构建)
└── README.md
```

---

## 11. Goals & Non-Goals

### Goals
1. 支持流畅的 slides 生成，纯视觉方案
2. 图片生成可以并行处理，slides 之间互不影响
3. 展示当前 slides 的总体成本

### Non-Goals
1. 不支持导出成 pptx
2. 不支持多人协作
3. 不支持用户认证

---

## 12. 设计决策

1. **blake3 hash 命名**: 相同文字自动复用图片，减少 API 调用
2. **无数据库**: 仅用 YAML 文件存储，纯文件系统实现
3. **无认证**: 本地 app，不需要权限管理
4. **双 Provider 支持**: Gemini 和 MiniMax 可选，通过配置切换
