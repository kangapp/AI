# 侧边栏缩略图 + Slide 编辑弹窗 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强编辑页面侧边栏，提供缩略图和标题显示；双击打开编辑弹窗支持修改文本、生成图片、选择展示图。

**Architecture:** 在现有编辑页面基础上，新增 SlideEditModal 组件处理 slide 编辑流程。前端使用 Zustand store 集中管理状态，后端新增 title 提取 API。

**Tech Stack:** React + TypeScript + Zustand (前端), FastAPI + Pydantic (后端), MiniMax/Gemini LLM API

---

## 文件结构变更

### 后端变更
- **Modify:** `backend/models.py` - Slide 模型新增 title, thumbnail 字段
- **Modify:** `backend/slides_manager.py` - update_slide 方法支持更新 title/thumbnail
- **Modify:** `backend/main.py` - 新增 extract-title API 端点

### 前端变更
- **Modify:** `frontend/src/types.ts` - Slide 接口新增 title, thumbnail 字段
- **Modify:** `frontend/src/api.ts` - 新增 extractTitle API，新增 updateSlideWithThumbnail 方法
- **Modify:** `frontend/src/stores/slidesStore.ts` - 新增 updateSlideFull 方法支持完整字段更新
- **Modify:** `frontend/src/components/SlideItem.tsx` - 显示缩略图和标题，响应双击事件
- **Create:** `frontend/src/components/SlideEditModal.tsx` - 新建编辑弹窗组件
- **Modify:** `frontend/src/components/Sidebar.tsx` - 传递 onEdit 回调

---

## Task 1: 后端 - 更新 Slide 模型

**Files:**
- Modify: `backend/models.py:20-27`

- [ ] **Step 1: 修改 SlideUpdate 模型**

```python
class SlideUpdate(BaseModel):
    text: Optional[str] = Field(None, min_length=1)
    title: Optional[str] = None
    thumbnail: Optional[str] = None
```

- [ ] **Step 2: 修改 Slide 模型添加新字段**

```python
class Slide(SlideBase):
    sid: str = Field(..., description="唯一标识符")
    title: Optional[str] = None   # 新增
    thumbnail: Optional[str] = None # 新增
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Step 3: 提交变更**

```bash
git add backend/models.py
git commit -m "feat: add title and thumbnail fields to Slide model"
```

---

## Task 2: 后端 - 更新 slides_manager

**Files:**
- Modify: `backend/slides_manager.py:62-69`

- [ ] **Step 1: 更新 update_slide 方法**

```python
def update_slide(self, sid: str, slide_data: SlideUpdate, slug: str = "default") -> Optional[Slide]:
    outline = self._load_outline(slug)
    for s in outline.get("slides", []):
        if s["sid"] == sid:
            if slide_data.text is not None:
                s["text"] = slide_data.text
            if slide_data.title is not None:
                s["title"] = slide_data.title
            if slide_data.thumbnail is not None:
                s["thumbnail"] = slide_data.thumbnail
            self._save_outline(outline, slug)
            return Slide(**s)
    return None
```

- [ ] **Step 2: 提交变更**

```bash
git add backend/slides_manager.py
git commit -m "feat: update_slide supports title and thumbnail fields"
```

---

## Task 3: 后端 - 添加 extract-title API

**Files:**
- Modify: `backend/main.py:207-212` (在 update_slide 端点后添加)

- [ ] **Step 1: 添加 extract-title 请求模型**

```python
class ExtractTitleRequest(BaseModel):
    text: str
```

- [ ] **Step 2: 添加 extract-title 端点**

```python
@app.post("/api/projects/{slug}/slides/{sid}/extract-title")
async def extract_title(slug: str, sid: str, request: ExtractTitleRequest):
    """从 slide 文本提取标题"""
    slide = slides_manager.get_slide_by_sid(sid, slug)
    if slide is None:
        raise HTTPException(status_code=404, detail="Slide not found")

    # 使用 Gemini API 提取标题
    if not apiiyi_api_key:
        raise HTTPException(status_code=500, detail="APIIYI_API_KEY not configured")

    url = "https://api.apiyi.com/v1beta/models/gemini-3-pro-image-preview:generateContent"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {apiyi_api_key}"
    }

    prompt = f"""从以下文本提取一个简短的标题（10-20字），只返回标题，不要其他内容：

{request.text}

标题:"""

    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    title = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    return {"title": title}
```

- [ ] **Step 3: 提交变更**

```bash
git add backend/main.py
git commit -m "feat: add extract-title API endpoint"
```

---

## Task 4: 前端 - 更新 types

**Files:**
- Modify: `frontend/src/types.ts:1-5`

- [ ] **Step 1: 更新 Slide 接口**

```typescript
export interface Slide {
  sid: string;
  text: string;
  title?: string;      // AI 提取的标题
  thumbnail?: string;  // 该 slide 的展示图 URL
  created_at: string;
}
```

- [ ] **Step 2: 提交变更**

```bash
git add frontend/src/types.ts
git commit -m "feat: add title and thumbnail to Slide interface"
```

---

## Task 5: 前端 - 更新 API client

**Files:**
- Modify: `frontend/src/api.ts:38-56`

- [ ] **Step 1: 更新 slidesApi.update 方法**

```typescript
update: (slug: string, sid: string, text: string, title?: string, thumbnail?: string): Promise<Slide> =>
  fetchJSON(`/projects/${slug}/slides/${sid}`, {
    method: 'PUT',
    body: JSON.stringify({ text, ...(title !== undefined && { title }), ...(thumbnail !== undefined && { thumbnail }) }),
  }),
```

- [ ] **Step 2: 添加 extractTitle 方法**

```typescript
extractTitle: (slug: string, sid: string, text: string): Promise<{ title: string }> =>
  fetchJSON(`/projects/${slug}/slides/${sid}/extract-title`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),
```

- [ ] **Step 3: 添加 generateMultipleImages 方法**

```typescript
generateMultipleImages: (slug: string, sid: string, provider: 'gemini' | 'minimax' = 'minimax', count: number = 2): Promise<GenerateResponse[]> =>
  Promise.all(
    Array.from({ length: count }, () =>
      fetchJSON<GenerateResponse>(`/projects/${slug}/slides/${sid}/generate`, {
        method: 'POST',
        body: JSON.stringify({ provider, force: true }),
      })
    )
  ),
```

- [ ] **Step 4: 提交变更**

```bash
git add frontend/src/api.ts
git commit -m "feat: add extractTitle and generateMultipleImages API methods"
```

---

## Task 6: 前端 - 更新 slidesStore

**Files:**
- Modify: `frontend/src/stores/slidesStore.ts:87-98`

- [ ] **Step 1: 添加 updateSlideFull 方法**

```typescript
updateSlideFull: (sid: string, text: string, title?: string, thumbnail?: string) => Promise<void> {
  const { selectedProjectSlug } = get();
  const slug = selectedProjectSlug || 'default';
  try {
    await slidesApi.update(slug, sid, text, title, thumbnail);
    set(state => ({
      slides: state.slides.map(s =>
        s.sid === sid ? { ...s, text, ...(title !== undefined && { title }), ...(thumbnail !== undefined && { thumbnail }) } : s
      )
    }));
  } catch (err) {
    set({ error: (err as Error).message });
  }
},
```

- [ ] **Step 2: 在接口中添加方法声明**

```typescript
// 在 SlidesState 接口中添加:
updateSlideFull: (sid: string, text: string, title?: string, thumbnail?: string) => Promise<void>;
```

- [ ] **Step 3: 提交变更**

```bash
git add frontend/src/stores/slidesStore.ts
git commit -m "feat: add updateSlideFull method to slidesStore"
```

---

## Task 7: 前端 - 创建 SlideEditModal 组件

**Files:**
- Create: `frontend/src/components/SlideEditModal.tsx`

- [ ] **Step 1: 创建 SlideEditModal 组件**

```tsx
import { useState } from 'react';
import type { Slide } from '../types';
import { slidesApi } from '../api';

interface SlideEditModalProps {
  slide: Slide;
  projectSlug: string;
  onClose: () => void;
  onSave: (updatedSlide: Slide) => void;
}

type ModalState = 'idle' | 'extracting' | 'generating' | 'selecting' | 'saving';

export default function SlideEditModal({ slide, projectSlug, onClose, onSave }: SlideEditModalProps) {
  const [text, setText] = useState(slide.text);
  const [title, setTitle] = useState(slide.title || '');
  const [provider, setProvider] = useState<'minimax' | 'gemini'>('minimax');
  const [state, setState] = useState<ModalState>('idle');
  const [generatedImages, setGeneratedImages] = useState<{ hash: string; url: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(slide.thumbnail || null);

  const handleExtractTitle = async () => {
    setState('extracting');
    try {
      const result = await slidesApi.extractTitle(projectSlug, slide.sid, text);
      setTitle(result.title);
    } catch (err) {
      console.error('Failed to extract title:', err);
    } finally {
      setState('idle');
    }
  };

  const handleGenerateImages = async () => {
    setState('generating');
    try {
      const results = await slidesApi.generateMultipleImages(projectSlug, slide.sid, provider, 2);
      setGeneratedImages(results.map(r => ({ hash: r.hash, url: r.image_url })));
      setState('selecting');
    } catch (err) {
      console.error('Failed to generate images:', err);
      setState('idle');
    }
  };

  const handleSave = async () => {
    setState('saving');
    try {
      const updated = await slidesApi.update(projectSlug, slide.sid, text, title || undefined, selectedImage || undefined);
      onSave(updated);
    } catch (err) {
      console.error('Failed to save:', err);
      setState('idle');
    }
  };

  return (
    <div className="fixed inset-0 bg-text-primary/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-hard">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-text-primary">编辑 Slide</h2>
          <button onClick={onClose} className="text-text-primary/60 hover:text-text-primary text-2xl">×</button>
        </div>

        <div className="space-y-4">
          {/* Provider */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-primary/70">Provider:</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'minimax' | 'gemini')}
              className="px-3 py-1.5 bg-bg-light rounded-lg text-sm text-text-primary border border-text-primary/10"
            >
              <option value="minimax">MiniMax</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          {/* Text Content */}
          <div>
            <label className="block text-sm font-medium text-text-primary/70 mb-1">文本内容</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-bg-light rounded-lg text-sm text-text-primary border border-text-primary/10 resize-none focus:outline-none focus:border-primary"
            />
          </div>

          {/* Extract Title */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExtractTitle}
              disabled={state === 'extracting'}
              className="px-4 py-2 bg-bg-light hover:bg-primary/20 text-text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {state === 'extracting' ? '提取中...' : '提取标题'}
            </button>
            {title && <span className="text-sm text-text-primary/70">{title}</span>}
          </div>

          <hr className="border-text-primary/10" />

          {/* Image Generation */}
          <div>
            <label className="block text-sm font-medium text-text-primary/70 mb-2">图片生成</label>
            <button
              onClick={handleGenerateImages}
              disabled={state === 'generating' || state === 'saving'}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {state === 'generating' ? '生成中...' : '生成 2 张图片'}
            </button>
          </div>

          {/* Image Selection */}
          {(state === 'selecting' || generatedImages.length > 0) && (
            <div className="flex gap-3">
              {generatedImages.map((img, idx) => (
                <div
                  key={img.hash}
                  onClick={() => setSelectedImage(img.url)}
                  className={`relative w-32 h-32 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${
                    selectedImage === img.url ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <img src={img.url} alt={`Generated ${idx + 1}`} className="w-full h-full object-cover" />
                  {selectedImage === img.url && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-xs text-text-primary">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-primary/60 hover:text-text-primary transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={state === 'saving' || state === 'generating'}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-text-primary font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {state === 'saving' ? '保存中...' : '确认保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交变更**

```bash
git add frontend/src/components/SlideEditModal.tsx
git commit -m "feat: add SlideEditModal component"
```

---

## Task 8: 前端 - 更新 SlideItem 组件

**Files:**
- Modify: `frontend/src/components/SlideItem.tsx`

- [ ] **Step 1: 更新 SlideItem 显示缩略图和标题**

```tsx
import { useState } from 'react';
import type { Slide } from '../types';
import { useSlidesStore } from '../stores/slidesStore';
import SlideEditModal from './SlideEditModal';

interface SlideItemProps {
  slide: Slide;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export default function SlideItem({ slide, isSelected, onSelect, onDelete }: SlideItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(slide.text);
  const { updateSlide, images, updateSlideFull } = useSlidesStore();

  // 获取缩略图: 优先使用 slide.thumbnail，否则使用第一张生成的图片
  const getThumbnail = () => {
    if (slide.thumbnail) {
      return slide.thumbnail;
    }
    const slideImages = images[slide.sid] || [];
    return slideImages[0]?.url || null;
  };

  const thumbnail = getThumbnail();
  const displayTitle = slide.title || slide.text.slice(0, 30);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSaveEdit = (updatedSlide: Slide) => {
    updateSlideFull(updatedSlide.sid, updatedSlide.text, updatedSlide.title, updatedSlide.thumbnail);
    setIsEditing(false);
  };

  return (
    <>
      <div
        className={`p-3 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'bg-primary text-text-primary'
            : 'bg-bg-light text-text-primary/70 hover:bg-primary/20'
        }`}
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
      >
        <div className="flex items-center gap-3">
          {/* 缩略图 */}
          {thumbnail ? (
            <div className="w-16 h-9 rounded overflow-hidden flex-shrink-0 bg-text-primary/10">
              <img src={thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-9 rounded flex-shrink-0 bg-text-primary/10 flex items-center justify-center">
              <span className="text-text-primary/30 text-xs">无图</span>
            </div>
          )}

          {/* 标题和状态 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayTitle}</p>
            {slide.thumbnail && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                已生成
              </span>
            )}
          </div>

          {/* 删除按钮 */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-xs opacity-50 hover:opacity-100 hover:text-red-500"
          >
            ×
          </button>
        </div>
      </div>

      {/* 编辑弹窗 */}
      {isEditing && (
        <SlideEditModal
          slide={slide}
          projectSlug={useSlidesStore.getState().selectedProjectSlug || 'default'}
          onClose={() => setIsEditing(false)}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: 提交变更**

```bash
git add frontend/src/components/SlideItem.tsx
git commit -m "feat: update SlideItem with thumbnail and title display"
```

---

## Task 9: 前端 - 更新 Sidebar 传递 projectSlug

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx:26-34`

- [ ] **Step 1: 确保 SlideItem 接收正确的 projectSlug**

Sidebar 组件已正确传递 projectSlug 给 SlideItem，无需修改。确认代码如下：

```tsx
slides.map((slide) => (
  <SlideItem
    key={slide.sid}
    slide={slide}
    isSelected={slide.sid === selectedSid}
    onSelect={() => selectSlide(slide.sid)}
    onDelete={() => deleteSlide(slide.sid)}
  />
))
```

- [ ] **Step 2: 提交变更**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "chore: Sidebar already passes correct props to SlideItem"
```

---

## 验证步骤

1. 启动后端: `cd backend && python main.py`
2. 启动前端: `cd frontend && npm run dev`
3. 打开 http://localhost:3003
4. 创建或选择一个项目
5. 创建几个 slides 并生成图片
6. 验证侧边栏显示缩略图和标题
7. 双击 slide 打开编辑弹窗
8. 测试提取标题功能
9. 测试生成 2 张图片并选择
10. 保存后验证侧边栏更新

---

## 依赖关系

```
Task 1 (models) → Task 2 (slides_manager) → Task 3 (main.py extract-title)
                                            ↓
Task 4 (frontend types) → Task 5 (api) → Task 6 (slidesStore)
                                            ↓
                    Task 7 (SlideEditModal) ← Task 8 (SlideItem)
                                              ↓
                                    Task 9 (Sidebar - 确认)
```

**前置任务:** Task 1-3 是后端任务，Task 4-6 是前端基础设施，Task 7-8 是核心组件。
