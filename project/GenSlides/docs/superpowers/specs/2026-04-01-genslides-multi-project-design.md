# GenSlides 多项目系统设计文档

## 1. 概述

**项目名称**: GenSlides 多项目扩展
**核心功能**: 支持多个独立项目，每个项目有统一的风格描述，所有 slide 图片遵循该风格生成
**目标用户**: 需要创建多个不同风格幻灯片集的用户

---

## 2. 设计背景

现有系统是单项目模型，所有 slides 在同一个集合中。用户需要：
- 创建多个项目（如"动漫风格项目"、"写实摄影项目"）
- 每个项目有独立的风格配置
- 统一风格生成，保持系列一致性

---

## 3. 技术方案

### 3.1 目录结构

```
project/GenSlides/
├── projects/                      # 所有项目根目录
│   ├── default/                   # 默认项目 (向后兼容)
│   │   ├── project.yml           # 默认项目配置
│   │   └── slides/
│   │       ├── outline.yml       # slides 数据 (从旧位置迁移)
│   │       └── images/           # 生成的图片
│   ├── <slug>/                    # 用户创建的项目
│   │   ├── project.yml           # 项目信息
│   │   └── slides/
│   │       ├── outline.yml       # slides 数据
│   │       └── images/          # 生成的图片 (<sid>/<hash>.jpg)
│   └── another-project/
│       └── ...
└── backend/                       # 后端代码 (无需大改)
```

**默认项目初始化:**
- 首次启动时，系统自动创建 `default` 项目
- `default` 项目的风格为 `photorealistic`，无自定义描述
- 现有单项目用户的数据（`slides/` 和 `slides/images/`）自动迁移到 `default` 项目

### 3.2 project.yml 结构

```yaml
name: "项目名称"
slug: "project-slug"
style: "anime"                    # 预设风格 key
style_prompt: "高对比度，柔和光线"  # 自定义补充描述
created_at: "2026-04-01T10:00:00Z"
```

### 3.3 预设风格定义

| Key | 名称 | 默认描述 |
|-----|------|---------|
| `photorealistic` | 写实摄影 | 照片级真实感，高画质 |
| `anime` | 动漫/二次元 | 日系动漫画风，清晰线条 |
| `ink-wash` | 水墨/国风 | 中国传统水墨画风格 |
| `cyberpunk` | 赛博朋克 | 未来科技感，霓虹灯光 |
| `minimalist` | 极简主义 | 简洁留白设计 |
| `oil-painting` | 油画/艺术 | 艺术绘画质感 |

---

## 4. 前端设计

### 4.1 页面结构

```
启动器页面 (/)
├── Header (Logo + "GenSlides")
├── 创建项目按钮
└── 项目列表 (卡片网格)
    └── 项目卡片 (名称 + 时间 + 缩略图)

项目编辑页面 (/project/<slug>)
├── Header (返回按钮 + 项目名 + 播放按钮)
├── 侧边栏 (slides 列表)
├── 主预览区 (图片预览)
└── 缩略图条
```

### 4.2 启动器页面

**布局:**
- 顶部: Logo + "GenSlides" 标题
- 中部: "创建项目" 按钮 (突出显示)
- 下方: 项目卡片网格 (如果有项目)

**项目卡片:**
- 显示项目名称 (最多显示 50 字符，超出截断)
- 显示创建时间
- 显示第一个 slide 的缩略图 (如果有)
- 点击进入项目编辑页

### 4.3 创建项目弹窗

**触发:** 点击"创建项目"按钮

**字段:**
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 项目名称 | text | 是 | 最多 50 字符 |
| 风格 | select | 是 | 6 个预设选项 |
| 自定义描述 | textarea | 否 | 对所选风格的补充说明 |

**预设风格选项:**
```
写实摄影 - 照片级真实感
动漫/二次元 - 日系动漫画风
水墨/国风 - 中国传统水墨画风格
赛博朋克 - 未来科技感
极简主义 - 简洁留白设计
油画/艺术 - 艺术绘画质感
```

**流程:**
1. 用户填写表单
2. 点击确认 → 创建项目文件夹和 project.yml
3. 自动跳转到新项目的编辑页面

### 4.4 项目编辑页面

与现有界面相同，但:
- Header 显示项目名称和"返回"按钮
- 所有操作针对当前项目的 slides

### 4.5 删除项目确认弹窗

**触发:** 项目卡片上的删除按钮

**内容:**
```
确认删除 "项目名称"？
此操作将删除该项目下的所有内容：
- N 个 slides
- X 张已生成的图片

[取消] [确认删除]
```

---

## 5. 后端 API 设计

### 5.1 新增端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `GET /api/projects` | GET | 获取所有项目列表 |
| `POST /api/projects` | POST | 创建新项目 |
| `GET /api/projects/{slug}` | GET | 获取项目详情 |
| `DELETE /api/projects/{slug}` | DELETE | 删除项目 (确认后) |

### 5.2 API 响应示例

**GET /api/projects**
```json
{
  "projects": [
    {
      "slug": "my-anime-project",
      "name": "我的动漫项目",
      "style": "anime",
      "style_prompt": "高对比度",
      "created_at": "2026-04-01T10:00:00Z",
      "slide_count": 5,
      "thumbnail_url": "/api/projects/my-anime-project/thumbnail"
    }
  ]
}
```

**POST /api/projects**
```json
// Request
{
  "name": "我的动漫项目",
  "style": "anime",
  "style_prompt": "高对比度，柔和光线"
}

// Response
{
  "slug": "my-anime-project",
  "name": "我的动漫项目",
  "style": "anime",
  "style_prompt": "高对比度，柔和光线",
  "created_at": "2026-04-01T10:00:00Z"
}
```

### 5.3 现有端点变化

现有端点添加 `slug` 参数 (项目路径):
- `GET /api/projects/{slug}/slides`
- `POST /api/projects/{slug}/slides`
- `PUT /api/projects/{slug}/slides/{sid}`
- `DELETE /api/projects/{slug}/slides/{sid}`
- `POST /api/projects/{slug}/slides/{sid}/generate`

**向后兼容:** 不带 `slug` 参数时使用 `default` 项目

### 5.4 错误处理

| 场景 | HTTP 状态码 | 响应 |
|------|-------------|------|
| 项目不存在 | 404 | `{"detail": "Project not found"}` |
| Slug 冲突 (同名项目) | 409 | `{"detail": "Project with this name already exists"}` |
| 项目名称超长 | 422 | `{"detail": "Project name must be 50 characters or less"}` |
| Slug 生成失败 | 400 | `{"detail": "Invalid project name"}` |

**Slug 冲突处理:**
- 创建项目时，如果 slug 已存在，后端自动在末尾添加数字后缀
- 例如: `my-project` 已存在 → `my-project-2`

### 5.4 图片生成逻辑变化

生成图片时，风格描述通过以下方式注入:

```python
# image_generator.py
async def generate_image(
    self,
    sid: str,
    text: str,
    provider: ImageProvider = ImageProvider.MINIMAX,
    force: bool = False,
    project_style: str = ""  # 新增参数
) -> GenerateResponse:

    # 构建完整 prompt
    full_prompt = f"{project_style}, {text}" if project_style else text
```

---

## 6. 数据流

### 6.1 创建项目流程

```
用户填写表单 (名称 + 风格 + 自定义描述)
    │
    ▼
POST /api/projects
    │
    ▼
后端:
1. 生成 slug (slugify name)
2. 创建目录结构
3. 写入 project.yml
4. 创建空的 slides/outline.yml
    │
    ▼
返回新项目信息
    │
    ▼
前端跳转至 /project/<slug>
```

### 6.2 图片生成流程

```
用户输入 slide 文字 → 保存
    │
    ▼
计算 blake3 hash → 检查缓存
    │
    ├─── 已存在 ─── 直接返回
    │
    ▼ (不存在)
GET /api/projects/<slug> 获取项目风格
    │
    ▼
风格 + 文字 拼接成完整 prompt
    │
    ▼
调用 AI API 生成图片
    │
    ▼
保存图片 → 更新 outline.yml
```

---

## 7. 组件变更

### 7.1 新增组件

| 组件 | 说明 |
|------|------|
| `LauncherPage` | 启动器页面 (项目列表 + 创建入口) |
| `ProjectCard` | 项目卡片 (显示在启动器页) |
| `CreateProjectModal` | 创建项目弹窗 |
| `DeleteConfirmModal` | 删除确认弹窗 |

### 7.2 修改组件

| 组件 | 变更 |
|------|------|
| `App` | 根据路由显示 LauncherPage 或 ProjectPage |
| `Header` | 添加返回按钮和项目名称显示 |
| `Sidebar` | 使用 project_slug 区分不同项目 |
| `MainPreview` | 传递项目风格到 API |

---

## 8. 路由设计

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | LauncherPage | 启动器 |
| `/project/:slug` | ProjectPage | 项目编辑页 |

---

## 9. 样式/交互不变项

以下功能保持不变:
- 全屏播放逻辑
- 缩略图切换
- 成本追踪显示
- MiniMax/Gemini provider 切换
- blake3 图片缓存机制

---

## 10. 实现优先级

### Phase 1: 核心项目系统
1. 后端: Projects CRUD API
2. 后端: 修改现有 slides API 支持 project slug
3. 前端: 启动器页面和项目卡片
4. 前端: 创建项目弹窗

### Phase 2: 风格集成
5. 后端: 修改图片生成支持 style prompt
6. 前端: 传递项目风格到图片生成
7. 前端: 删除项目确认弹窗

---

## 11. 测试要点

1. **项目 CRUD**: 创建、读取、删除项目
2. **风格传递**: 验证生成图片时风格被正确注入
3. **向后兼容**: 不带 slug 的 API 调用仍能正常工作
4. **目录隔离**: 不同项目的 slides 和图片完全隔离
5. **Slug 冲突**: 同名项目创建时 slug 自动添加数字后缀
6. **默认项目**: 首次启动时 default 项目被正确初始化
7. **数据迁移**: 现有单项目数据正确迁移到 default 项目
