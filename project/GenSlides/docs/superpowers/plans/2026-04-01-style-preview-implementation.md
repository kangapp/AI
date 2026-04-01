# 风格预览选择功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现风格预览选择功能，用户创建项目时可预览 2 张不同 AI 生成的风格参考图

**Architecture:**
- 后端: 新增 `/api/projects/preview-style` 端点，并行调用 MiniMax 和 Gemini 生成预览图
- 前端: CreateProjectModal 增加多步骤流程 (form → previewing → selecting)
- 图片参考: 优先使用 Gemini 原生图片参考功能

**Tech Stack:** Python + FastAPI + TypeScript + React + Zustand

---

## 阶段 1: 后端模型和 API

### Task 1: 后端 - 添加 StylePreviewRequest 模型

**Files:**
- Modify: `backend/models.py` (添加 StylePreviewRequest)

- [ ] **Step 1: 添加 StylePreviewRequest 模型**

在 `models.py` 中添加:

```python
class StylePreviewRequest(BaseModel):
    style_prompt: str
```

- [ ] **Step 2: 添加 style_reference_image 字段**

修改 `Project` 和 `ProjectCreate`:

```python
class Project(BaseModel):
    # ... existing fields
    style_reference_image: Optional[str] = None

class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=50)
    style: ProjectStyle
    style_prompt: str = ""
    style_reference_image: Optional[str] = None  # 新增
```

- [ ] **Step 3: 测试导入**

Run: `cd backend && python3 -c "from models import StylePreviewRequest, Project, ProjectCreate; print('Models OK')"`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add backend/models.py
git commit -m "feat: add StylePreviewRequest and style_reference_image field"
```

---

### Task 2: 后端 - 添加预览生成端点

**Files:**
- Modify: `backend/main.py` (添加 /api/projects/preview-style 端点)
- Modify: `backend/image_generator.py` (添加 generate_preview_image 方法)

- [ ] **Step 1: 在 image_generator.py 添加 generate_preview_image 方法**

```python
async def generate_preview_image(
    self,
    style_prompt: str,
    provider: ImageProvider = ImageProvider.MINIMAX
) -> Optional[bytes]:
    """生成预览图，返回图片字节数据，失败返回 None"""
    try:
        # 使用风格描述生成纯风格参考图
        prompt = f"{style_prompt}, abstract texture only, no specific content"
        output_path = Path(tempfile.gettempdir()) / f"preview_{uuid.uuid4().hex}.jpg"

        if provider == ImageProvider.GEMINI:
            await self._generate_gemini(prompt, output_path)
        else:
            await self._generate_minimax(prompt, output_path)

        with open(output_path, "rb") as f:
            return f.read()
    except Exception as e:
        print(f"Preview generation failed for {provider}: {e}")
        return None
```

- [ ] **Step 2: 在 image_generator.py 添加 generate_raw 方法签名**

```python
async def generate_raw(
    self,
    text: str,
    provider: ImageProvider = ImageProvider.MINIMAX
) -> bytes:
    """直接生成图片，返回字节数据"""
    # 实现复用现有生成逻辑，但返回字节而非保存文件
```

- [ ] **Step 3: 在 main.py 添加 /api/projects/preview-style 端点**

```python
from models import StylePreviewRequest
import base64

@app.post("/api/projects/preview-style")
async def generate_style_preview(request: StylePreviewRequest):
    """生成风格预览图，并行调用 MiniMax 和 Gemini"""
    import asyncio

    async def generate_minimax():
        try:
            image_bytes = await image_generator.generate_preview_image(
                request.style_prompt,
                ImageProvider.MINIMAX
            )
            if image_bytes:
                return f"data:image/jpeg;base64,{base64.b64encode(image_bytes).decode()}"
            return None
        except Exception as e:
            print(f"MiniMax preview failed: {e}")
            return None

    async def generate_gemini():
        try:
            image_bytes = await image_generator.generate_preview_image(
                request.style_prompt,
                ImageProvider.GEMINI
            )
            if image_bytes:
                return f"data:image/jpeg;base64,{base64.b64encode(image_bytes).decode()}"
            return None
        except Exception as e:
            print(f"Gemini preview failed: {e}")
            return None

    minimax_task = asyncio.create_task(generate_minimax())
    gemini_task = asyncio.create_task(generate_gemini())

    results = await asyncio.gather(minimax_task, gemini_task)

    return {
        "minimax_image": results[0],
        "gemini_image": results[1]
    }
```

- [ ] **Step 4: 测试端点**

Run: `cd backend && python3 -c "from main import app; print('API loads OK')"`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add backend/main.py backend/image_generator.py
git commit -m "feat: add /api/projects/preview-style endpoint"
```

---

### Task 3: 后端 - 支持参考图生成

**Files:**
- Modify: `backend/image_generator.py` (添加 Gemini 图片参考支持)
- Modify: `backend/projects_manager.py` (保存参考图)

- [ ] **Step 1: 在 image_generator.py 添加 _generate_gemini_with_reference 方法**

```python
async def _generate_gemini_with_reference(
    self,
    text: str,
    reference_image_base64: str,
    output_path: Path
) -> None:
    """使用参考图生成 (Gemini 原生支持)"""
    if not self.apiyi_api_key:
        raise ValueError("APIIYI_API_KEY must be set")

    url = "https://api.apiyi.com/v1beta/models/gemini-3-pro-image-preview:generateContent"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {self.apiyi_api_key}"
    }

    # 解析参考图 base64
    ref_data = reference_image_base64.replace("data:image/jpeg;base64,", "")
    ref_bytes = base64.b64decode(ref_data)

    payload = {
        "contents": [{
            "parts": [
                {"text": text},
                {"inlineData": {"mimeType": "image/jpeg", "data": ref_data}}
            ]
        }],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {
                "aspectRatio": "16:9",
                "imageSize": "2K"
            }
        }
    }

    async with httpx.AsyncClient(timeout=360.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

        image_base64 = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
        image_bytes = base64.b64decode(image_base64)

        with open(output_path, "wb") as f:
            f.write(image_bytes)
```

- [ ] **Step 2: 修改 generate_image 方法支持参考图**

```python
async def generate_image(
    self,
    sid: str,
    text: str,
    provider: ImageProvider = ImageProvider.MINIMAX,
    force: bool = False,
    project_slug: str = "default",
    style_reference_image: Optional[str] = None  # 新增参数
) -> GenerateResponse:
    # ... 现有代码 ...

    # 获取项目风格并注入到 prompt
    style_prompt = ""
    if self.projects_manager:
        project = self.projects_manager.get_project(project_slug)
        if project:
            style_prompt = project.get_full_style()
            if project.style_reference_image and not style_reference_image:
                style_reference_image = project.style_reference_image

    full_text = f"{style_prompt}, {text}" if style_prompt else text

    # 调用 API 生成图片
    if style_reference_image and provider == ImageProvider.GEMINI:
        await self._generate_gemini_with_reference(full_text, style_reference_image, image_path)
    elif provider == ImageProvider.GEMINI:
        await self._generate_gemini(full_text, image_path)
    else:
        await self._generate_minimax(full_text, image_path)
```

- [ ] **Step 3: 修改 projects_manager 保存参考图**

```python
def create_project(self, data: ProjectCreate) -> Project:
    """创建新项目"""
    # ... 现有代码 ...

    # 处理参考图
    style_ref_image = data.style_reference_image
    if style_ref_image:
        # 保存参考图到项目目录
        ref_image_path = project_dir / "style_reference.jpg"
        ref_data = style_ref_image.replace("data:image/jpeg;base64,", "")
        ref_bytes = base64.b64decode(ref_data)
        with open(ref_image_path, "wb") as f:
            f.write(ref_bytes)
        # 保存相对路径到 project.yml
        project.style_reference_image = str(ref_image_path)

    self._save_project(project)
    return project
```

- [ ] **Step 4: 测试**

Run: `cd backend && python3 -c "from main import app; from image_generator import ImageGenerator; print('OK')"`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add backend/image_generator.py backend/projects_manager.py
git commit -m "feat: add Gemini image reference support"
```

---

## 阶段 2: 前端组件

### Task 4: 前端 - CreateProjectModal 多步骤流程

**Files:**
- Modify: `frontend/src/components/CreateProjectModal.tsx`

- [ ] **Step 1: 添加类型和状态定义**

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

- [ ] **Step 2: 实现 Step 1 - 表单填写**

```tsx
function StepForm({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState('');
  const [style, setStyle] = useState(ProjectStyle.CUSTOM);
  const [stylePrompt, setStylePrompt] = useState('');

  return (
    <>
      {/* 项目名称 */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">项目名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          placeholder="最多 50 字符"
          className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
          autoFocus
        />
      </div>

      {/* 风格选择 */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">风格</label>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as ProjectStyle)}
          className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
        >
          {STYLE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label} - {opt.desc}
            </option>
          ))}
        </select>
      </div>

      {/* 风格描述 */}
      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2">
          {isCustomStyle ? '风格描述' : '补充描述'}
        </label>
        <textarea
          value={stylePrompt}
          onChange={(e) => setStylePrompt(e.target.value)}
          placeholder={isCustomStyle ? '描述你想要的图片风格...' : '对所选风格的补充说明...'}
          rows={3}
          className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
        />
      </div>

      <button
        onClick={onNext}
        disabled={!name.trim()}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors"
      >
        生成风格预览
      </button>
    </>
  );
}
```

- [ ] **Step 3: 实现 Step 2 - 预览生成中**

```tsx
function StepPreview() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="flex gap-8 mb-8">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-gray-400 text-sm">MiniMax</span>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-gray-400 text-sm">Gemini</span>
        </div>
      </div>
      <p className="text-gray-400">正在生成风格预览...</p>
    </div>
  );
}
```

- [ ] **Step 4: 实现 Step 3 - 选择界面**

```tsx
function StepSelect({
  minimaxImage,
  geminiImage,
  selectedImage,
  onSelect,
  onSkip,
  onCreate,
  isCreating
}: StepSelectProps) {
  return (
    <>
      <p className="text-gray-400 text-sm mb-4 text-center">
        选择一张图片作为风格参考，或跳过
      </p>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => onSelect('minimax')}
          disabled={!minimaxImage}
          className={`flex-1 p-2 rounded-lg border-2 transition-colors ${
            selectedImage === 'minimax'
              ? 'border-blue-500 bg-blue-500/20'
              : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          <span className="text-xs text-gray-500 block mb-1">MiniMax</span>
          {minimaxImage ? (
            <img src={minimaxImage} alt="MiniMax" className="w-full rounded" />
          ) : (
            <div className="w-full aspect-video bg-gray-800 rounded flex items-center justify-center">
              <span className="text-gray-600 text-xs">生成失败</span>
            </div>
          )}
        </button>

        <button
          onClick={() => onSelect('gemini')}
          disabled={!geminiImage}
          className={`flex-1 p-2 rounded-lg border-2 transition-colors ${
            selectedImage === 'gemini'
              ? 'border-purple-500 bg-purple-500/20'
              : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          <span className="text-xs text-gray-500 block mb-1">Gemini</span>
          {geminiImage ? (
            <img src={geminiImage} alt="Gemini" className="w-full rounded" />
          ) : (
            <div className="w-full aspect-video bg-gray-800 rounded flex items-center justify-center">
              <span className="text-gray-600 text-xs">生成失败</span>
            </div>
          )}
        </button>
      </div>

      <button
        onClick={onSkip}
        className="w-full py-2 text-gray-500 hover:text-gray-400 text-sm mb-4"
      >
        不使用参考图
      </button>

      <button
        onClick={onCreate}
        disabled={isCreating}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors"
      >
        {isCreating ? '创建中...' : '创建项目'}
      </button>
    </>
  );
}
```

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/CreateProjectModal.tsx
git commit -m "feat: add multi-step CreateProjectModal with style preview"
```

---

### Task 5: 前端 - API 调用集成

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/stores/projectsStore.ts`

- [ ] **Step 1: 添加 preview-style API**

```typescript
export const projectsApi = {
  // ... existing methods

  previewStyle: (style_prompt: string): Promise<{
    minimax_image: string | null;
    gemini_image: string | null;
  }> =>
    fetchJSON('/projects/preview-style', {
      method: 'POST',
      body: JSON.stringify({ style_prompt }),
    }),
};
```

- [ ] **Step 2: 修改 createProject 支持 style_reference_image**

```typescript
createProject: (data: {
  name: string;
  style: ProjectStyle;
  style_prompt: string;
  style_reference_image?: string;
}): Promise<Project> =>
  fetchJSON('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/api.ts frontend/src/stores/projectsStore.ts
git commit -m "feat: add preview-style API and update createProject"
```

---

## 阶段 3: 集成测试

### Task 6: 集成测试

**Files:**
- Test: `backend/test_preview_style.py`

- [ ] **Step 1: 测试预览生成 API**

Run: `cd backend && python3 -c "from main import app; print('API loads')"`

- [ ] **Step 2: 测试前端构建**

Run: `cd frontend && npm run build`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: complete style preview selection feature"
```

---

## 任务清单

- [ ] Task 1: 后端 - 添加 StylePreviewRequest 模型
- [ ] Task 2: 后端 - 添加预览生成端点
- [ ] Task 3: 后端 - 支持参考图生成
- [ ] Task 4: 前端 - CreateProjectModal 多步骤流程
- [ ] Task 5: 前端 - API 调用集成
- [ ] Task 6: 集成测试
