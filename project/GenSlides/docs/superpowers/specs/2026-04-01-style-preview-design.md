# 风格预览选择功能设计文档

## 1. 概述

**功能名称**: 风格预览选择
**核心功能**: 创建项目时，用户输入风格描述后，预览 2 张由不同 AI 生成的风格参考图，选择一张作为后续生成的参考，或跳过
**目标用户**: 需要精确控制幻灯片风格一致性的用户

---

## 2. 设计背景

现有系统创建项目时只输入文字风格描述，用户无法预知生成效果。新功能允许用户在创建项目前预览风格，选择一个参考图来确保后续生成的一致性。

---

## 3. 技术方案

### 3.1 交互流程

```
用户填写项目名称 + 风格描述
         ↓
    点击"生成风格预览"
         ↓
   并行调用 MiniMax API
   并行调用 Gemini API
         ↓
   显示风格选择界面（2张图）
         ↓
┌────────┼────────┐
↓        ↓        ↓
选择A   选择B   跳过
         ↓
   创建项目
   保存参考图（如果选择）
         ↓
   跳转编辑器
```

### 3.2 API 设计

#### 风格预览生成

**POST /api/projects/preview-style**

请求:
```json
{
  "style_prompt": "水墨画风格，朦胧山水"
}
```

响应:
```json
{
  "minimax_image": "data:image/jpeg;base64,...",
  "gemini_image": "data:image/jpeg;base64,..."
}
```

#### 项目创建

**POST /api/projects**

请求:
```json
{
  "name": "我的项目",
  "style": "custom",
  "style_prompt": "水墨画风格，朦胧山水",
  "style_reference_image": "data:image/jpeg;base64,...(可选)"
}
```

### 3.3 数据模型

#### 请求模型

```python
# models.py
class StylePreviewRequest(BaseModel):
    style_prompt: str
```

#### project.yml 新增字段

```yaml
style_reference_image: "base64字符串或空"
```

```python
# models.py
class Project(BaseModel):
    # ... 现有字段
    style_reference_image: Optional[str] = None

class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=50)
    style: ProjectStyle
    style_prompt: str = ""
    style_reference_image: Optional[str] = None  # 新增
```

### 3.4 预览生成逻辑

```python
async def generate_preview_image(style_prompt: str, provider: str) -> str:
    """生成预览图，返回 base64 字符串"""
    # 使用风格描述生成一张无内容的纯风格图
    # 使用默认占位内容（如"抽象纹理"）
    prompt = f"{style_prompt}, abstract texture, no specific content"
    image_bytes = await image_generator.generate_raw(prompt, provider)
    return base64.b64encode(image_bytes).decode()
```

### 3.5 超时处理

| 场景 | 处理 |
|------|------|
| 单 API 超时 (60s) | 返回另一张图片，失败的位置灰 |
| 两者都超时 | 显示错误，允许跳过 |
| 限流 (429) | 等待后重试，最多 2 次 |

---

## 4. 前端设计

### 4.1 CreateProjectModal 状态

```typescript
type CreateStep = 'form' | 'previewing' | 'selecting';

interface CreateState {
  step: CreateStep;
  name: string;
  style: ProjectStyle;
  stylePrompt: string;
  minimaxImage: string | null;
  geminiImage: string | null;
  selectedImage: 'minimax' | 'gemini' | null;
}
```

### 4.2 界面布局

**Step 1: 表单填写**
- 项目名称输入
- 风格选择（下拉）
- 风格描述输入
- "生成风格预览"按钮

**Step 2: 生成中**
- MiniMax 和 Gemini 并行动画指示器
- 禁止其他操作

**Step 3: 选择界面**
- 显示 2 张生成的图片（并排）
- 点击选择或"不使用参考图"
- "创建项目"按钮

### 4.3 组件结构

```
CreateProjectModal
├── StepForm (名称 + 风格 + 描述)
├── StepPreview (加载动画)
└── StepSelect (图片选择)
```

---

## 5. 后端设计

### 5.1 新增端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/projects/preview-style` | POST | 生成风格预览图 |
| `/api/projects` | POST | 创建项目（支持 style_reference_image） |

### 5.2 预览生成逻辑

```python
@app.post("/api/projects/preview-style")
async def generate_style_preview(request: StylePreviewRequest):
    # 并行调用两个 API
    minimax_task = generate_preview_image(request.style_prompt, "minimax")
    gemini_task = generate_preview_image(request.style_prompt, "gemini")

    minimax_result, gemini_result = await asyncio.gather(minimax_task, gemini_task)

    return {
        "minimax_image": minimax_result,
        "gemini_image": gemini_result
    }
```

### 5.3 图片生成

利用现有的 ImageGenerator，添加预览生成模式：
- 输入只有风格描述（无具体内容）
- 返回 base64 格式图片

---

## 6. 图片参考功能

### 6.1 实现策略

由于 MiniMax API 的 reference_image 参数支持情况需验证，优先使用 **Gemini 的图片参考功能**。

### 6.2 Gemini 图片参考

Gemini 原生支持图片作为输入，可直接传入参考图：

```python
payload = {
    "contents": [{
        "parts": [
            {"text": text},
            {"inlineData": {"mimeType": "image/jpeg", "data": base64_image}}
        ]
    }]
}
```

### 6.3 后端注入逻辑

```python
async def generate_with_reference(
    text: str,
    style_reference_image: str = None,
    provider: str = "gemini"
) -> str:
    if style_reference_image and provider == "gemini":
        # Gemini 原生支持图片参考
        return await self._generate_gemini_with_reference(text, style_reference_image, image_path)
    else:
        # 普通生成
        return await self._generate_gemini(text, image_path)
```

### 6.4 回退策略

如果参考图生成失败，自动回退到纯文字生成，不阻塞用户。

---

**注意**: MiniMax 的 reference_image 支持待后续 API 文档更新后验证。

---

## 7. 错误处理

| 场景 | 处理 |
|------|------|
| MiniMax 生成失败 | 显示 Gemini 图片，MiniMax 位置灰 |
| Gemini 生成失败 | 显示 MiniMax 图片，Gemini 位置灰 |
| 两者都失败 | 显示错误提示，允许跳过 |
| API 限流 (429) | 等待 2 秒重试，最多 2 次 |
| 网络超时 (60s) | 超时后标记失败，显示另一张 |
| 用户跳过 | 项目无参考图，后续正常生成 |
| base64 数据过大 | 限制图片尺寸，压缩后返回 |

---

## 8. 实现优先级

1. 后端: `/api/projects/preview-style` 端点
2. 前端: CreateProjectModal 状态和步骤
3. 前端: 预览图片生成和选择
4. 后端: 项目创建支持参考图字段
5. 后端: 生成时注入参考图

---

## 9. 测试要点

1. 预览生成 - 验证两张图同时生成
2. 选择功能 - 点击选择高亮，切换选择
3. 跳过功能 - 不选直接创建
4. 参考图保存 - 验证 project.yml 包含参考图
5. 参考图生效 - 后续生成使用参考图
