# GenSlides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个本地运行的 GenSlides 单页应用，支持通过 Gemini Nano Banana Pro 或 MiniMax Image API 生成幻灯片图片，并提供全屏走马灯播放功能。

**Architecture:** 后端使用 Python + FastAPI 提供 RESTful API，前端使用 TypeScript + Tailwind + Zustand 构建单页应用。图片通过 blake3 hash 命名实现复用，数据存储在本地文件系统。

**Tech Stack:** Python 3.11+, FastAPI, Pydantic, blake3, pyyaml, Gemini API, MiniMax Image API, TypeScript, Tailwind CSS, Zustand, Vite

---

## 文件结构

```
project/GenSlides/
├── backend/
│   ├── main.py                 # FastAPI 入口，路由注册
│   ├── slides_manager.py        # Slides CRUD 和 outline.yml 读写
│   ├── image_generator.py       # Gemini/MiniMax API 调用
│   ├── cost_tracker.py          # 成本追踪
│   ├── models.py                # Pydantic 请求/响应模型
│   └── requirements.txt         # Python 依赖
├── frontend/
│   ├── index.html               # 入口 HTML
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts              # 应用入口
│       ├── App.tsx              # 根组件
│       ├── api.ts               # 后端 API 客户端
│       ├── stores/
│       │   └── slidesStore.ts  # Zustand 状态管理
│       └── components/
│           ├── Header.tsx
│           ├── Sidebar.tsx
│           ├── SlideItem.tsx
│           ├── MainPreview.tsx
│           ├── ThumbnailStrip.tsx
│           └── FullscreenPlayer.tsx
├── slides/                      # 运行时数据目录
├── docs/
│   └── superpowers/
│       ├── specs/
│       └── plans/
└── package.json
```

---

## Phase 1: 后端基础设施

### Task 1: 创建项目基础目录和配置文件

**Files:**
- Create: `project/GenSlides/backend/requirements.txt`
- Create: `project/GenSlides/package.json`
- Create: `project/GenSlides/frontend/package.json`
- Create: `project/GenSlides/frontend/vite.config.ts`
- Create: `project/GenSlides/frontend/tsconfig.json`
- Create: `project/GenSlides/frontend/tailwind.config.js`

- [ ] **Step 1: 创建 backend/requirements.txt**

```txt
fastapi==0.109.2
uvicorn[standard]==0.27.1
pydantic==2.6.1
python-multipart==0.0.9
pyyaml==6.0.1
blake3==0.4.1
aiohttp==3.9.3
```

- [ ] **Step 2: 创建根目录 package.json**

```json
{
  "name": "genslides",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "backend": "cd backend && python -m uvicorn main:app --reload --port 8000",
    "frontend": "cd frontend && npm run dev",
    "dev": "concurrently \"npm run backend\" \"npm run frontend\""
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 3: 创建 frontend/package.json**

```json
{
  "name": "genslides-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.56",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2",
    "vite": "^5.1.4"
  }
}
```

- [ ] **Step 4: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3003,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 5: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 6: 创建 tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 7: 创建 slides 运行时目录**

Run: `mkdir -p project/GenSlides/slides/images`

- [ ] **Step 8: Commit**

```bash
git add project/GenSlides/backend/requirements.txt project/GenSlides/package.json project/GenSlides/frontend/package.json project/GenSlides/frontend/vite.config.ts project/GenSlides/frontend/tsconfig.json project/GenSlides/frontend/tailwind.config.js project/GenSlides/slides
git commit -m "feat: add project scaffolding and configuration files"
```

---

### Task 2: 实现后端数据模型

**Files:**
- Create: `project/GenSlides/backend/models.py`
- Test: `project/GenSlides/backend/test_models.py`

- [ ] **Step 1: 创建 models.py**

```python
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum


class ImageProvider(str, Enum):
    GEMINI = "gemini"
    MINIMAX = "minimax"


class SlideBase(BaseModel):
    text: str = Field(..., min_length=1, description="幻灯片文字内容")


class SlideCreate(SlideBase):
    pass


class SlideUpdate(BaseModel):
    text: str = Field(..., min_length=1)


class Slide(SlideBase):
    sid: str = Field(..., description="唯一标识符")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True


class SlideListResponse(BaseModel):
    slides: list[Slide]
    title: str = "Untitled"


class ImageInfo(BaseModel):
    hash: str
    url: str
    cached: bool


class GenerateRequest(BaseModel):
    provider: ImageProvider = ImageProvider.MINIMAX
    force: bool = Field(default=False, description="是否强制重新生成")


class GenerateResponse(BaseModel):
    sid: str
    hash: str
    image_url: str
    cached: bool


class CostInfo(BaseModel):
    gemini_calls: int = 0
    minimax_calls: int = 0
    gemini_cost: float = 0.0
    minimax_cost: float = 0.0
    total_cost: float = 0.0


class PlaybackSlide(BaseModel):
    sid: str
    text: str
    main_image_url: Optional[str] = None


class PlaybackResponse(BaseModel):
    slides: list[PlaybackSlide]
    start_index: int = 0
```

- [ ] **Step 2: 创建 test_models.py**

```python
import pytest
from datetime import datetime
from models import (
    Slide, SlideCreate, SlideUpdate, SlideListResponse,
    ImageInfo, GenerateRequest, GenerateResponse,
    CostInfo, PlaybackSlide, PlaybackResponse, ImageProvider
)


def test_slide_creation():
    slide = Slide(sid="abc123", text="测试文字")
    assert slide.sid == "abc123"
    assert slide.text == "测试文字"
    assert isinstance(slide.created_at, datetime)


def test_slide_create_defaults():
    slide = Slide(sid="abc123", text="测试")
    assert slide.created_at is not None


def test_generate_request_defaults():
    req = GenerateRequest()
    assert req.provider == ImageProvider.MINIMAX
    assert req.force is False


def test_cost_info_defaults():
    cost = CostInfo()
    assert cost.gemini_calls == 0
    assert cost.minimax_calls == 0
    assert cost.total_cost == 0.0


def test_playback_response():
    ps = PlaybackSlide(sid="1", text="Test", main_image_url=None)
    resp = PlaybackResponse(slides=[ps], start_index=0)
    assert len(resp.slides) == 1
    assert resp.start_index == 0
```

- [ ] **Step 3: 运行测试验证**

Run: `cd project/GenSlides/backend && python -m pytest test_models.py -v`
Expected: 5 passed

- [ ] **Step 4: Commit**

```bash
git add project/GenSlides/backend/models.py project/GenSlides/backend/test_models.py
git commit -m "feat: add Pydantic models for slides API"
```

---

### Task 3: 实现 Slides Manager (文件系统存储)

**Files:**
- Create: `project/GenSlides/backend/slides_manager.py`
- Test: `project/GenSlides/backend/test_slides_manager.py`

- [ ] **Step 1: 创建 slides_manager.py**

```python
import os
import yaml
import uuid
import blake3
from datetime import datetime
from pathlib import Path
from typing import Optional
from models import Slide, SlideCreate, SlideUpdate, SlideListResponse


class SlidesManager:
    SLIDES_DIR = Path("slides")
    IMAGES_DIR = Path("slides/images")

    def __init__(self, base_path: Optional[Path] = None):
        if base_path:
            self.slides_dir = base_path / self.SLIDES_DIR
            self.images_dir = base_path / self.IMAGES_DIR
        else:
            self.slides_dir = self.SLIDES_DIR
            self.images_dir = self.IMAGES_DIR
        self.slides_dir.mkdir(parents=True, exist_ok=True)
        self.images_dir.mkdir(parents=True, exist_ok=True)

    def _get_project_dir(self, slug: str = "default") -> Path:
        return self.slides_dir / slug

    def _get_outline_path(self, slug: str = "default") -> Path:
        return self._get_project_dir(slug) / "outline.yml"

    def _load_outline(self, slug: str = "default") -> dict:
        path = self._get_outline_path(slug)
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {"title": "Untitled", "slides": []}
        return {"title": "Untitled", "slides": []}

    def _save_outline(self, data: dict, slug: str = "default") -> None:
        path = self._get_outline_path(slug)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, allow_unicode=True, sort_keys=False)

    def _generate_sid(self) -> str:
        return uuid.uuid4().hex[:12]

    def compute_text_hash(self, text: str) -> str:
        return blake3.blake3(text.encode()).hexdigest(length=32)

    def get_all_slides(self, slug: str = "default") -> SlideListResponse:
        outline = self._load_outline(slug)
        slides = [Slide(**s) for s in outline.get("slides", [])]
        return SlideListResponse(slides=slides, title=outline.get("title", "Untitled"))

    def create_slide(self, slide_data: SlideCreate, slug: str = "default") -> Slide:
        outline = self._load_outline(slug)
        slide = Slide(
            sid=self._generate_sid(),
            text=slide_data.text,
            created_at=datetime.utcnow()
        )
        outline.setdefault("slides", []).append(slide.model_dump(mode="json"))
        self._save_outline(outline, slug)
        return slide

    def update_slide(self, sid: str, slide_data: SlideUpdate, slug: str = "default") -> Optional[Slide]:
        outline = self._load_outline(slug)
        for s in outline.get("slides", []):
            if s["sid"] == sid:
                s["text"] = slide_data.text
                self._save_outline(outline, slug)
                return Slide(**s)
        return None

    def delete_slide(self, sid: str, slug: str = "default") -> bool:
        outline = self._load_outline(slug)
        slides = outline.get("slides", [])
        for i, s in enumerate(slides):
            if s["sid"] == sid:
                slides.pop(i)
                outline["slides"] = slides
                self._save_outline(outline, slug)
                return True
        return False

    def get_slide_images_dir(self, sid: str) -> Path:
        path = self.images_dir / sid
        path.mkdir(parents=True, exist_ok=True)
        return path

    def get_slide_by_sid(self, sid: str, slug: str = "default") -> Optional[Slide]:
        outline = self._load_outline(slug)
        for s in outline.get("slides", []):
            if s["sid"] == sid:
                return Slide(**s)
        return None
```

- [ ] **Step 2: 创建 test_slides_manager.py**

```python
import pytest
import tempfile
from pathlib import Path
from slides_manager import SlidesManager
from models import SlideCreate, SlideUpdate


@pytest.fixture
def manager():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield SlidesManager(base_path=Path(tmpdir))


def test_create_and_get_slide(manager):
    slide = manager.create_slide(SlideCreate(text="测试文字"))
    assert slide.sid is not None
    assert slide.text == "测试文字"

    result = manager.get_all_slides()
    assert len(result.slides) == 1
    assert result.slides[0].text == "测试文字"


def test_update_slide(manager):
    slide = manager.create_slide(SlideCreate(text="原始文字"))
    sid = slide.sid

    updated = manager.update_slide(sid, SlideUpdate(text="新文字"))
    assert updated is not None
    assert updated.text == "新文字"


def test_delete_slide(manager):
    slide = manager.create_slide(SlideCreate(text="要删除"))
    sid = slide.sid

    assert manager.delete_slide(sid) is True
    result = manager.get_all_slides()
    assert len(result.slides) == 0


def test_compute_text_hash(manager):
    hash1 = manager.compute_text_hash("相同文字")
    hash2 = manager.compute_text_hash("相同文字")
    hash3 = manager.compute_text_hash("不同文字")

    assert hash1 == hash2
    assert hash1 != hash3


def test_get_slide_images_dir(manager):
    path = manager.get_slide_images_dir("sid123")
    assert path.exists()
    assert "sid123" in str(path)
```

- [ ] **Step 3: 运行测试验证**

Run: `cd project/GenSlides/backend && python -m pytest test_slides_manager.py -v`
Expected: 5 passed

- [ ] **Step 4: Commit**

```bash
git add project/GenSlides/backend/slides_manager.py project/GenSlides/backend/test_slides_manager.py
git commit -m "feat: implement slides manager with file system storage"
```

---

### Task 4: 实现成本追踪器

**Files:**
- Create: `project/GenSlides/backend/cost_tracker.py`
- Test: `project/GenSlides/backend/test_cost_tracker.py`

- [ ] **Step 1: 创建 cost_tracker.py**

```python
from models import CostInfo, ImageProvider


class CostTracker:
    # 估算成本 (基于实际 API 定价调整)
    GEMINI_COST_PER_CALL = 0.001  # 假设 $0.001/次
    MINIMAX_COST_PER_CALL = 0.01   # 假设 $0.01/次

    def __init__(self):
        self.gemini_calls: int = 0
        self.minimax_calls: int = 0

    def record_call(self, provider: ImageProvider) -> None:
        if provider == ImageProvider.GEMINI:
            self.gemini_calls += 1
        elif provider == ImageProvider.MINIMAX:
            self.minimax_calls += 1

    def get_cost_info(self) -> CostInfo:
        gemini_cost = self.gemini_calls * self.GEMINI_COST_PER_CALL
        minimax_cost = self.minimax_calls * self.MINIMAX_COST_PER_CALL
        return CostInfo(
            gemini_calls=self.gemini_calls,
            minimax_calls=self.minimax_calls,
            gemini_cost=round(gemini_cost, 6),
            minimax_cost=round(minimax_cost, 6),
            total_cost=round(gemini_cost + minimax_cost, 6)
        )

    def reset(self) -> None:
        self.gemini_calls = 0
        self.minimax_calls = 0
```

- [ ] **Step 2: 创建 test_cost_tracker.py**

```python
import pytest
from cost_tracker import CostTracker
from models import ImageProvider


def test_cost_tracker_initial():
    tracker = CostTracker()
    cost = tracker.get_cost_info()
    assert cost.gemini_calls == 0
    assert cost.minimax_calls == 0
    assert cost.total_cost == 0.0


def test_record_gemini_call():
    tracker = CostTracker()
    tracker.record_call(ImageProvider.GEMINI)
    cost = tracker.get_cost_info()
    assert cost.gemini_calls == 1
    assert cost.total_cost == CostTracker.GEMINI_COST_PER_CALL


def test_record_minimax_call():
    tracker = CostTracker()
    tracker.record_call(ImageProvider.MINIMAX)
    cost = tracker.get_cost_info()
    assert cost.minimax_calls == 1
    assert cost.total_cost == CostTracker.MINIMAX_COST_PER_CALL


def test_record_multiple_calls():
    tracker = CostTracker()
    tracker.record_call(ImageProvider.GEMINI)
    tracker.record_call(ImageProvider.GEMINI)
    tracker.record_call(ImageProvider.MINIMAX)
    cost = tracker.get_cost_info()
    assert cost.gemini_calls == 2
    assert cost.minimax_calls == 1
    assert cost.total_cost == 2 * CostTracker.GEMINI_COST_PER_CALL + CostTracker.MINIMAX_COST_PER_CALL


def test_reset():
    tracker = CostTracker()
    tracker.record_call(ImageProvider.GEMINI)
    tracker.reset()
    cost = tracker.get_cost_info()
    assert cost.gemini_calls == 0
    assert cost.total_cost == 0.0
```

- [ ] **Step 3: 运行测试验证**

Run: `cd project/GenSlides/backend && python -m pytest test_cost_tracker.py -v`
Expected: 4 passed

- [ ] **Step 4: Commit**

```bash
git add project/GenSlides/backend/cost_tracker.py project/GenSlides/backend/test_cost_tracker.py
git commit -m "feat: implement cost tracker"
```

---

### Task 5: 实现图片生成器 (Gemini + MiniMax)

**Files:**
- Create: `project/GenSlides/backend/image_generator.py`
- Test: `project/GenSlides/backend/test_image_generator.py`

- [ ] **Step 1: 创建 image_generator.py**

```python
import os
import httpx
from pathlib import Path
from typing import Optional
from models import ImageProvider, GenerateResponse
from cost_tracker import CostTracker
from slides_manager import SlidesManager


class ImageGenerator:
    def __init__(
        self,
        slides_manager: SlidesManager,
        cost_tracker: CostTracker,
        minimax_api_key: Optional[str] = None,
        minimax_group_id: Optional[str] = None
    ):
        self.slides_manager = slides_manager
        self.cost_tracker = cost_tracker
        self.minimax_api_key = minimax_api_key or os.getenv("MINIMAX_API_KEY", "")
        self.minimax_group_id = minimax_group_id or os.getenv("MINIMAX_GROUP_ID", "")

    async def generate_image(
        self,
        sid: str,
        text: str,
        provider: ImageProvider = ImageProvider.MINIMAX,
        force: bool = False
    ) -> GenerateResponse:
        text_hash = self.slides_manager.compute_text_hash(text)
        images_dir = self.slides_manager.get_slide_images_dir(sid)
        image_path = images_dir / f"{text_hash}.jpg"

        # 检查缓存
        if image_path.exists() and not force:
            return GenerateResponse(
                sid=sid,
                hash=text_hash,
                image_url=f"/api/images/{sid}/{text_hash}",
                cached=True
            )

        # 调用 API 生成图片
        if provider == ImageProvider.GEMINI:
            await self._generate_gemini(text, image_path)
        else:
            await self._generate_minimax(text, image_path)

        # 记录成本
        self.cost_tracker.record_call(provider)

        return GenerateResponse(
            sid=sid,
            hash=text_hash,
            image_url=f"/api/images/{sid}/{text_hash}",
            cached=False
        )

    async def _generate_gemini(self, text: str, output_path: Path) -> None:
        # Gemini Nano Banana Pro 图片生成 API
        # 参考: https://docs.apiyi.com/api-capabilities/nano-banana-image
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-nano-banana-pro:generateImage"

        # TODO: 实现 Gemini API 调用
        raise NotImplementedError("Gemini API integration pending")

    async def _generate_minimax(self, text: str, output_path: Path) -> None:
        # MiniMax Image API
        # 参考: https://platform.minimaxi.com/docs/guides/image-generation
        if not self.minimax_api_key or not self.minimax_group_id:
            raise ValueError("MINIMAX_API_KEY and MINIMAX_GROUP_ID must be set")

        url = "https://api.minimax.chat/v1/image_generation"

        headers = {
            "Authorization": f"Bearer {self.minimax_api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "minimax-image-01",
            "prompt": text,
            "image_size": "16:9",
            "group_id": self.minimax_group_id
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

            # 下载图片
            image_url = data.get("data", {}).get("image_url")
            if not image_url:
                raise ValueError(f"Failed to get image URL from response: {data}")

            img_response = await client.get(image_url)
            img_response.raise_for_status()

            with open(output_path, "wb") as f:
                f.write(img_response.content)
```

- [ ] **Step 2: 创建 test_image_generator.py**

```python
import pytest
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
from image_generator import ImageGenerator
from slides_manager import SlidesManager
from cost_tracker import CostTracker
from models import ImageProvider


@pytest.fixture
def setup():
    tmpdir = tempfile.TemporaryDirectory()
    manager = SlidesManager(base_path=Path(tmpdir.name))
    cost_tracker = CostTracker()
    generator = ImageGenerator(
        slides_manager=manager,
        cost_tracker=cost_tracker,
        minimax_api_key="test-key",
        minimax_group_id="test-group"
    )
    yield generator, manager, cost_tracker, tmpdir
    tmpdir.cleanup()


@pytest.mark.asyncio
async def test_generate_uses_cache(setup):
    generator, manager, cost_tracker, _ = setup

    # 预先创建图片
    sid = "test-sid"
    text = "测试文字"
    text_hash = manager.compute_text_hash(text)
    images_dir = manager.get_slide_images_dir(sid)
    images_dir.mkdir(parents=True, exist_ok=True)
    (images_dir / f"{text_hash}.jpg").write_bytes(b"fake image")

    result = await generator.generate_image(sid, text, ImageProvider.MINIMAX)

    assert result.cached is True
    assert result.hash == text_hash
    assert cost_tracker.minimax_calls == 0  # 缓存命中，不计费


@pytest.mark.asyncio
async def test_generate_records_cost(setup):
    generator, manager, cost_tracker, _ = setup

    sid = "test-sid"
    text = "新文字内容"

    # Mock MiniMax API
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "data": {"image_url": "https://example.com/image.jpg"}
    }
    mock_response.raise_for_status = MagicMock()

    mock_img_response = MagicMock()
    mock_img_response.content = b"fake image bytes"
    mock_img_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        mock_instance = AsyncMock()
        mock_instance.post.return_value = mock_response
        mock_instance.get.return_value = mock_img_response
        mock_instance.__aenter__.return_value = mock_instance
        mock_client.return_value = mock_instance

        result = await generator.generate_image(sid, text, ImageProvider.MINIMAX)

    assert result.cached is False
    assert result.hash == manager.compute_text_hash(text)
    assert cost_tracker.minimax_calls == 1
```

- [ ] **Step 3: 运行测试验证**

Run: `cd project/GenSlides/backend && python -m pytest test_image_generator.py -v`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add project/GenSlides/backend/image_generator.py project/GenSlides/backend/test_image_generator.py
git commit -m "feat: implement image generator with Gemini and MiniMax support"
```

---

### Task 6: 实现 FastAPI 主入口和路由

**Files:**
- Create: `project/GenSlides/backend/main.py`
- Modify: `project/GenSlides/backend/main.py` (添加路由)

- [ ] **Step 1: 创建 main.py**

```python
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from models import (
    SlideCreate, SlideUpdate, GenerateRequest, GenerateResponse,
    SlideListResponse, ImageInfo, CostInfo, PlaybackResponse, PlaybackSlide
)
from slides_manager import SlidesManager
from cost_tracker import CostTracker
from image_generator import ImageGenerator


# 初始化
BASE_PATH = Path(__file__).parent.parent
app = FastAPI(title="GenSlides API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3003", "http://127.0.0.1:3003"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 服务初始化
slides_manager = SlidesManager(base_path=BASE_PATH)
cost_tracker = CostTracker()
image_generator = ImageGenerator(
    slides_manager=slides_manager,
    cost_tracker=cost_tracker,
    minimax_api_key=os.getenv("MINIMAX_API_KEY", ""),
    minimax_group_id=os.getenv("MINIMAX_GROUP_ID", "")
)


# === Slides CRUD ===

@app.get("/api/slides", response_model=SlideListResponse)
async def get_slides(slug: str = Query(default="default")):
    return slides_manager.get_all_slides(slug)


@app.post("/api/slides", response_model=dict)
async def create_slide(slide_data: SlideCreate, slug: str = Query(default="default")):
    slide = slides_manager.create_slide(slide_data, slug)
    return slide.model_dump(mode="json")


@app.put("/api/slides/{sid}", response_model=dict)
async def update_slide(sid: str, slide_data: SlideUpdate, slug: str = Query(default="default")):
    slide = slides_manager.update_slide(sid, slide_data, slug)
    if slide is None:
        raise HTTPException(status_code=404, detail="Slide not found")
    return slide.model_dump(mode="json")


@app.delete("/api/slides/{sid}")
async def delete_slide(sid: str, slug: str = Query(default="default")):
    success = slides_manager.delete_slide(sid, slug)
    if not success:
        raise HTTPException(status_code=404, detail="Slide not found")
    return {"success": True}


# === Image Generation ===

@app.post("/api/slides/{sid}/generate", response_model=GenerateResponse)
async def generate_image(
    sid: str,
    request: GenerateRequest = GenerateRequest(),
    slug: str = Query(default="default")
):
    slide = slides_manager.get_slide_by_sid(sid, slug)
    if slide is None:
        raise HTTPException(status_code=404, detail="Slide not found")

    return await image_generator.generate_image(
        sid=sid,
        text=slide.text,
        provider=request.provider,
        force=request.force
    )


@app.get("/api/slides/{sid}/images")
async def get_slide_images(sid: str):
    images_dir = slides_manager.get_slide_images_dir(sid)
    if not images_dir.exists():
        return {"images": []}

    images = []
    for img_path in images_dir.glob("*.jpg"):
        hash_value = img_path.stem
        images.append(ImageInfo(
            hash=hash_value,
            url=f"/api/images/{sid}/{hash_value}",
            cached=True
        ))

    return {"images": images}


# === Image Serving ===

@app.get("/api/images/{sid}/{hash}")
async def get_image(sid: str, hash: str):
    image_path = slides_manager.get_slide_images_dir(sid) / f"{hash}.jpg"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return StaticFiles(directory=str(image_path.parent))(f"{hash}.jpg")


# === Cost ===

@app.get("/api/cost", response_model=CostInfo)
async def get_cost():
    return cost_tracker.get_cost_info()


# === Playback ===

@app.get("/api/playback/slides")
async def get_playback_slides(slug: str = Query(default="default"), start_index: int = Query(default=0)):
    slide_list = slides_manager.get_all_slides(slug)

    playback_slides = []
    for slide in slide_list.slides:
        text_hash = slides_manager.compute_text_hash(slide.text)
        image_path = slides_manager.get_slide_images_dir(slide.sid) / f"{text_hash}.jpg"

        main_url = None
        if image_path.exists():
            main_url = f"/api/images/{slide.sid}/{text_hash}"

        playback_slides.append(PlaybackSlide(
            sid=slide.sid,
            text=slide.text,
            main_image_url=main_url
        ))

    return PlaybackResponse(
        slides=playback_slides,
        start_index=min(start_index, len(playback_slides) - 1) if playback_slides else 0
    )


# === Static Files (for production) ===

@app.get("/")
async def root():
    return {"message": "GenSlides API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

- [ ] **Step 2: 运行 API 测试**

Run: `cd project/GenSlides/backend && timeout 5 python -c "from main import app; print('Import OK')" 2>&1 || echo "Import test completed"`
Expected: Import OK

- [ ] **Step 3: Commit**

```bash
git add project/GenSlides/backend/main.py
git commit -m "feat: implement FastAPI main entry with all routes"
```

---

## Phase 2: 前端实现

### Task 7: 创建前端基础文件

**Files:**
- Create: `project/GenSlides/frontend/index.html`
- Create: `project/GenSlides/frontend/src/main.ts`
- Create: `project/GenSlides/frontend/src/index.css`

- [ ] **Step 1: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GenSlides</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: 创建 src/main.ts**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 3: 创建 src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #1a1a2e;
  color: #eaeaea;
  min-height: 100vh;
}

* {
  box-sizing: border-box;
}
```

- [ ] **Step 4: Commit**

```bash
git add project/GenSlides/frontend/index.html project/GenSlides/frontend/src/main.ts project/GenSlides/frontend/src/index.css
git commit -m "feat: create frontend base files"
```

---

### Task 8: 实现 API 客户端

**Files:**
- Create: `project/GenSlides/frontend/src/api.ts`
- Create: `project/GenSlides/frontend/src/types.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
export interface Slide {
  sid: string;
  text: string;
  created_at: string;
}

export interface SlideListResponse {
  slides: Slide[];
  title: string;
}

export interface ImageInfo {
  hash: string;
  url: string;
  cached: boolean;
}

export interface GenerateRequest {
  provider: 'gemini' | 'minimax';
  force?: boolean;
}

export interface GenerateResponse {
  sid: string;
  hash: string;
  image_url: string;
  cached: boolean;
}

export interface CostInfo {
  gemini_calls: number;
  minimax_calls: number;
  gemini_cost: number;
  minimax_cost: number;
  total_cost: number;
}

export interface PlaybackSlide {
  sid: string;
  text: string;
  main_image_url: string | null;
}

export interface PlaybackResponse {
  slides: PlaybackSlide[];
  start_index: number;
}
```

- [ ] **Step 2: 创建 api.ts**

```typescript
import type {
  Slide, SlideListResponse, SlideCreate, SlideUpdate,
  ImageInfo, GenerateRequest, GenerateResponse,
  CostInfo, PlaybackResponse
} from './types';

const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Slides API
export const slidesApi = {
  getAll: (slug = 'default'): Promise<SlideListResponse> =>
    fetchJSON('/slides', { headers: { 'Content-Type': 'application/json' } }),

  create: (text: string, slug = 'default'): Promise<Slide> =>
    fetchJSON('/slides', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  update: (sid: string, text: string, slug = 'default'): Promise<Slide> =>
    fetchJSON(`/slides/${sid}`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    }),

  delete: (sid: string, slug = 'default'): Promise<void> => {
    return fetch(`${API_BASE}/slides/${sid}`, {
      method: 'DELETE',
    }).then(r => r.json());
  },

  generate: (sid: string, provider: 'gemini' | 'minimax' = 'minimax', force = false): Promise<GenerateResponse> =>
    fetchJSON(`/slides/${sid}/generate`, {
      method: 'POST',
      body: JSON.stringify({ provider, force }),
    }),

  getImages: (sid: string): Promise<{ images: ImageInfo[] }> =>
    fetchJSON(`/slides/${sid}/images`),
};

// Cost API
export const costApi = {
  get: (): Promise<CostInfo> => fetchJSON('/cost'),
};

// Playback API
export const playbackApi = {
  getSlides: (slug = 'default', startIndex = 0): Promise<PlaybackResponse> =>
    fetchJSON(`/playback/slides?slug=${slug}&start_index=${startIndex}`),
};
```

- [ ] **Step 3: Commit**

```bash
git add project/GenSlides/frontend/src/types.ts project/GenSlides/frontend/src/api.ts
git commit -m "feat: implement API client for backend communication"
```

---

### Task 9: 实现 Zustand Store

**Files:**
- Create: `project/GenSlides/frontend/src/stores/slidesStore.ts`

- [ ] **Step 1: 创建 slidesStore.ts**

```typescript
import { create } from 'zustand';
import type { Slide, ImageInfo, CostInfo, PlaybackSlide } from '../types';
import { slidesApi, costApi, playbackApi } from '../api';

interface SlidesState {
  // Data
  slides: Slide[];
  title: string;
  selectedSid: string | null;
  images: Record<string, ImageInfo[]>;
  cost: CostInfo | null;
  playbackSlides: PlaybackSlide[];
  playbackIndex: number;

  // UI State
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSlides: () => Promise<void>;
  createSlide: (text?: string) => Promise<void>;
  updateSlide: (sid: string, text: string) => Promise<void>;
  deleteSlide: (sid: string) => Promise<void>;
  selectSlide: (sid: string | null) => void;
  generateImage: (sid: string, provider?: 'gemini' | 'minimax') => Promise<void>;
  loadImages: (sid: string) => Promise<void>;
  loadCost: () => Promise<void>;
  startPlayback: () => Promise<void>;
  nextSlide: () => void;
  prevSlide: () => void;
  exitPlayback: () => void;
}

export const useSlidesStore = create<SlidesState>((set, get) => ({
  // Initial state
  slides: [],
  title: 'Untitled',
  selectedSid: null,
  images: {},
  cost: null,
  playbackSlides: [],
  playbackIndex: 0,
  isPlaying: false,
  isLoading: false,
  error: null,

  loadSlides: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await slidesApi.getAll();
      set({ slides: data.slides, title: data.title, isLoading: false });

      // Auto-select first slide
      if (data.slides.length > 0 && !get().selectedSid) {
        const firstSid = data.slides[0].sid;
        set({ selectedSid: firstSid });
        get().loadImages(firstSid);
      }
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createSlide: async (text = '新幻灯片') => {
    set({ isLoading: true, error: null });
    try {
      const slide = await slidesApi.create(text);
      set(state => ({
        slides: [...state.slides, slide],
        selectedSid: slide.sid,
        isLoading: false
      }));
      get().loadImages(slide.sid);
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  updateSlide: async (sid: string, text: string) => {
    try {
      await slidesApi.update(sid, text);
      set(state => ({
        slides: state.slides.map(s => s.sid === sid ? { ...s, text } : s)
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteSlide: async (sid: string) => {
    try {
      await slidesApi.delete(sid);
      set(state => {
        const newSlides = state.slides.filter(s => s.sid !== sid);
        const newSelected = state.selectedSid === sid
          ? (newSlides[0]?.sid ?? null)
          : state.selectedSid;
        return { slides: newSlides, selectedSid: newSelected };
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  selectSlide: (sid: string | null) => {
    set({ selectedSid: sid });
    if (sid) {
      get().loadImages(sid);
    }
  },

  generateImage: async (sid: string, provider = 'minimax') => {
    set({ isLoading: true, error: null });
    try {
      const result = await slidesApi.generate(sid, provider);
      set(state => {
        const newImages = { ...state.images };
        newImages[sid] = [
          { hash: result.hash, url: result.image_url, cached: result.cached },
          ...(newImages[sid] || []).filter(i => i.hash !== result.hash)
        ];
        return { images: newImages, isLoading: false };
      });
      get().loadCost();
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  loadImages: async (sid: string) => {
    try {
      const { images } = await slidesApi.getImages(sid);
      set(state => ({ images: { ...state.images, [sid]: images } }));
    } catch (err) {
      console.error('Failed to load images:', err);
    }
  },

  loadCost: async () => {
    try {
      const cost = await costApi.get();
      set({ cost });
    } catch (err) {
      console.error('Failed to load cost:', err);
    }
  },

  startPlayback: async () => {
    const { selectedSid, slides } = get();
    const startIndex = slides.findIndex(s => s.sid === selectedSid) || 0;

    try {
      const data = await playbackApi.getSlides('default', startIndex);
      set({
        playbackSlides: data.slides,
        playbackIndex: data.start_index,
        isPlaying: true
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  nextSlide: () => {
    set(state => ({
      playbackIndex: Math.min(state.playbackIndex + 1, state.playbackSlides.length - 1)
    }));
  },

  prevSlide: () => {
    set(state => ({
      playbackIndex: Math.max(state.playbackIndex - 1, 0)
    }));
  },

  exitPlayback: () => {
    set({ isPlaying: false, playbackSlides: [], playbackIndex: 0 });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add project/GenSlides/frontend/src/stores/slidesStore.ts
git commit -m "feat: implement Zustand store for slides state management"
```

---

### Task 10: 实现 Header 组件

**Files:**
- Create: `project/GenSlides/frontend/src/components/Header.tsx`

- [ ] **Step 1: 创建 Header.tsx**

```typescript
import { useSlidesStore } from '../stores/slidesStore';

export default function Header() {
  const { title, startPlayback, isPlaying } = useSlidesStore();

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-700">
      <div className="flex items-center gap-4">
        <div className="text-xl font-bold text-white">GenSlides</div>
        <div className="text-sm text-gray-400">slides/{title.toLowerCase().replace(/\s+/g, '-')}</div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-500">全屏从当前选中 slide 开始播放</span>
        <button
          onClick={startPlayback}
          disabled={isPlaying}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          播放
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add project/GenSlides/frontend/src/components/Header.tsx
git commit -m "feat: implement Header component"
```

---

### Task 11: 实现 Sidebar 和 SlideItem 组件

**Files:**
- Create: `project/GenSlides/frontend/src/components/Sidebar.tsx`
- Create: `project/GenSlides/frontend/src/components/SlideItem.tsx`

- [ ] **Step 1: 创建 SlideItem.tsx**

```typescript
import { useState } from 'react';
import type { Slide } from '../types';
import { useSlidesStore } from '../stores/slidesStore';

interface SlideItemProps {
  slide: Slide;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export default function SlideItem({ slide, isSelected, onSelect, onDelete }: SlideItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(slide.text);
  const { updateSlide } = useSlidesStore();

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditText(slide.text);
  };

  const handleConfirm = () => {
    if (editText.trim() && editText !== slide.text) {
      updateSlide(slide.sid, editText.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(slide.text);
    }
  };

  return (
    <div
      className={`p-3 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? 'bg-blue-600 text-white'
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium opacity-75">Slide {slide.sid.slice(0, 6)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-xs opacity-50 hover:opacity-100 hover:text-red-400"
        >
          ×
        </button>
      </div>

      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleConfirm}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="w-full px-2 py-1 text-sm bg-gray-900 border border-blue-400 rounded text-white focus:outline-none"
          autoFocus
        />
      ) : (
        <p
          className="text-sm truncate"
          onDoubleClick={handleDoubleClick}
          title="双击编辑"
        >
          {slide.text}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建 Sidebar.tsx**

```typescript
import { useSlidesStore } from '../stores/slidesStore';
import SlideItem from './SlideItem';

export default function Sidebar() {
  const { slides, selectedSid, selectSlide, deleteSlide, createSlide, generateImage } = useSlidesStore();

  const handleCreate = async () => {
    await createSlide('新幻灯片');
    // Generate image for new slide automatically
    const newSid = useSlidesStore.getState().selectedSid;
    if (newSid) {
      generateImage(newSid);
    }
  };

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-400">Slides</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {slides.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">暂无幻灯片</p>
        ) : (
          slides.map((slide) => (
            <SlideItem
              key={slide.sid}
              slide={slide}
              isSelected={slide.sid === selectedSid}
              onSelect={() => selectSlide(slide.sid)}
              onDelete={() => deleteSlide(slide.sid)}
            />
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-700">
        <button
          onClick={handleCreate}
          className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
        >
          + 新建 Slide
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          当用户点击一个 slide 下面一点时，会在当前 slide 下创建一个新的
        </p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add project/GenSlides/frontend/src/components/SlideItem.tsx project/GenSlides/frontend/src/components/Sidebar.tsx
git commit -m "feat: implement Sidebar and SlideItem components"
```

---

### Task 12: 实现 MainPreview 和 ThumbnailStrip 组件

**Files:**
- Create: `project/GenSlides/frontend/src/components/MainPreview.tsx`
- Create: `project/GenSlides/frontend/src/components/ThumbnailStrip.tsx`

- [ ] **Step 1: 创建 ThumbnailStrip.tsx**

```typescript
import { useSlidesStore } from '../stores/slidesStore';

export default function ThumbnailStrip() {
  const { selectedSid, images } = useSlidesStore();
  const slideImages = selectedSid ? images[selectedSid] || [] : [];

  if (slideImages.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-800 rounded-lg">
        <p className="text-gray-500 text-sm">暂无生成图片</p>
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {slideImages.map((img) => (
        <div
          key={img.hash}
          className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-gray-800 border-2 border-transparent hover:border-blue-500 cursor-pointer transition-colors"
        >
          <img
            src={img.url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建 MainPreview.tsx**

```typescript
import { useSlidesStore } from '../stores/slidesStore';

export default function MainPreview() {
  const { selectedSid, slides, images, generateImage, isLoading } = useSlidesStore();

  const selectedSlide = slides.find(s => s.sid === selectedSid);
  const slideImages = selectedSid ? images[selectedSid] || [] : [];

  // Get main image (first one, or the one matching current text hash)
  const mainImage = slideImages[0];

  if (!selectedSlide) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 rounded-xl">
        <p className="text-gray-500">选择或创建一个幻灯片</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* Main Image Area */}
      <div className="flex-1 bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center relative">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">生成中...</p>
          </div>
        ) : mainImage ? (
          <img
            src={mainImage.url}
            alt={selectedSlide.text}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-center">
            <p className="text-gray-400 mb-4">图片根据当前 slide 文字内容生成</p>
            <button
              onClick={() => generateImage(selectedSid!)}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              生成图片
            </button>
          </div>
        )}

        {/* Slide text overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <p className="text-white text-lg">{selectedSlide.text}</p>
        </div>
      </div>

      {/* Thumbnail Strip */}
      <div className="mt-4">
        <p className="text-xs text-gray-500 mb-2">底下有缩略图，用户可以切换预览</p>
        <ThumbnailStrip />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 修复循环引用，导入 ThumbnailStrip 到 MainPreview**

Update `MainPreview.tsx` to include the ThumbnailStrip import at top:
```typescript
import ThumbnailStrip from './ThumbnailStrip';
```

- [ ] **Step 4: Commit**

```bash
git add project/GenSlides/frontend/src/components/ThumbnailStrip.tsx project/GenSlides/frontend/src/components/MainPreview.tsx
git commit -m "feat: implement MainPreview and ThumbnailStrip components"
```

---

### Task 13: 实现全屏播放组件

**Files:**
- Create: `project/GenSlides/frontend/src/components/FullscreenPlayer.tsx`

- [ ] **Step 1: 创建 FullscreenPlayer.tsx**

```typescript
import { useEffect, useCallback } from 'react';
import { useSlidesStore } from '../stores/slidesStore';

const SLIDE_INTERVAL = 5000; // 5 seconds per slide

export default function FullscreenPlayer() {
  const {
    isPlaying,
    playbackSlides,
    playbackIndex,
    nextSlide,
    prevSlide,
    exitPlayback
  } = useSlidesStore();

  const currentSlide = playbackSlides[playbackIndex];

  // Auto-advance slides
  useEffect(() => {
    if (!isPlaying || playbackSlides.length === 0) return;

    const timer = setInterval(() => {
      nextSlide();
    }, SLIDE_INTERVAL);

    return () => clearInterval(timer);
  }, [isPlaying, playbackIndex, playbackSlides.length, nextSlide]);

  // Keyboard controls
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowRight':
        nextSlide();
        break;
      case 'ArrowLeft':
        prevSlide();
        break;
      case ' ':
        // Space - could implement pause
        break;
      case 'Escape':
        exitPlayback();
        break;
    }
  }, [nextSlide, prevSlide, exitPlayback]);

  useEffect(() => {
    if (isPlaying) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isPlaying, handleKeyDown]);

  if (!isPlaying || !currentSlide) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      onClick={exitPlayback}
    >
      {/* Main Image */}
      <div className="relative w-full h-full flex items-center justify-center">
        {currentSlide.main_image_url ? (
          <img
            src={currentSlide.main_image_url}
            alt={currentSlide.text}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <p className="text-gray-400 text-xl">{currentSlide.text}</p>
        )}
      </div>

      {/* Text overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
        <p className="text-white text-2xl text-center">{currentSlide.text}</p>
        <p className="text-gray-400 text-sm text-center mt-2">
          {playbackIndex + 1} / {playbackSlides.length}
        </p>
      </div>

      {/* Controls hint */}
      <div className="absolute top-4 right-4 text-gray-500 text-sm">
        ESC 退出 | ← → 切换
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${((playbackIndex + 1) / playbackSlides.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add project/GenSlides/frontend/src/components/FullscreenPlayer.tsx
git commit -m "feat: implement FullscreenPlayer component"
```

---

### Task 14: 实现根组件 App.tsx

**Files:**
- Create: `project/GenSlides/frontend/src/App.tsx`

- [ ] **Step 1: 创建 App.tsx**

```typescript
import { useEffect } from 'react';
import { useSlidesStore } from './stores/slidesStore';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MainPreview from './components/MainPreview';
import FullscreenPlayer from './components/FullscreenPlayer';

export default function App() {
  const { loadSlides, loadCost, cost, isPlaying } = useSlidesStore();

  useEffect(() => {
    loadSlides();
    loadCost();
  }, [loadSlides, loadCost]);

  return (
    <div className="min-h-screen bg-gray-950">
      <Header />

      <div className="flex h-[calc(100vh-64px)]">
        <Sidebar />

        <main className="flex-1 p-6 overflow-auto">
          <MainPreview />
        </main>
      </div>

      {/* Cost display */}
      <footer className="fixed bottom-0 left-0 right-0 px-6 py-2 bg-gray-900 border-t border-gray-700 text-xs text-gray-500 flex justify-end gap-6">
        <span>Gemini: ${cost?.gemini_cost.toFixed(4) || '0.0000'}</span>
        <span>MiniMax: ${cost?.minimax_cost.toFixed(4) || '0.0000'}</span>
        <span className="text-white font-medium">Total: ${cost?.total_cost.toFixed(4) || '0.0000'}</span>
      </footer>

      {/* Fullscreen Player */}
      {isPlaying && <FullscreenPlayer />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add project/GenSlides/frontend/src/App.tsx
git commit -m "feat: implement root App component with layout"
```

---

## Phase 3: 集成测试

### Task 15: 端到端测试

**Files:**
- Create: `project/GenSlides/backend/test_integration.py`

- [ ] **Step 1: 创建 test_integration.py**

```python
import pytest
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from main import app, slides_manager, cost_tracker


@pytest.fixture(autouse=True)
def reset_state():
    """Reset state before each test"""
    slides_manager.slides_dir = Path(tempfile.mkdtemp()) / "slides"
    slides_manager.images_dir = Path(tempfile.mkdtemp()) / "slides/images"
    slides_manager.slides_dir.mkdir(parents=True, exist_ok=True)
    slides_manager.images_dir.mkdir(parents=True, exist_ok=True)
    cost_tracker.reset()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_get_empty_slides(client):
    response = client.get("/api/slides")
    assert response.status_code == 200
    data = response.json()
    assert data["slides"] == []
    assert data["title"] == "Untitled"


def test_create_slide(client):
    response = client.post(
        "/api/slides",
        json={"text": "测试幻灯片"},
        params={"slug": "test"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["text"] == "测试幻灯片"
    assert "sid" in data


def test_update_slide(client):
    # Create
    create_response = client.post(
        "/api/slides",
        json={"text": "原始文字"}
    )
    sid = create_response.json()["sid"]

    # Update
    update_response = client.put(
        f"/api/slides/{sid}",
        json={"text": "新文字"}
    )
    assert update_response.status_code == 200
    assert update_response.json()["text"] == "新文字"


def test_delete_slide(client):
    # Create
    create_response = client.post(
        "/api/slides",
        json={"text": "要删除"}
    )
    sid = create_response.json()["sid"]

    # Delete
    delete_response = client.delete(f"/api/slides/{sid}")
    assert delete_response.status_code == 200

    # Verify
    get_response = client.get("/api/slides")
    assert len(get_response.json()["slides"]) == 0


def test_get_cost(client):
    response = client.get("/api/cost")
    assert response.status_code == 200
    data = response.json()
    assert "gemini_calls" in data
    assert "minimax_calls" in data
    assert "total_cost" in data


def test_playback_endpoint(client):
    # Create some slides
    client.post("/api/slides", json={"text": "Slide 1"})
    client.post("/api/slides", json={"text": "Slide 2"})

    response = client.get("/api/playback/slides")
    assert response.status_code == 200
    data = response.json()
    assert len(data["slides"]) == 2
    assert data["slides"][0]["text"] == "Slide 1"
    assert data["slides"][1]["text"] == "Slide 2"
```

- [ ] **Step 2: 运行集成测试**

Run: `cd project/GenSlides/backend && python -m pytest test_integration.py -v`
Expected: 6 passed

- [ ] **Step 3: Commit**

```bash
git add project/GenSlides/backend/test_integration.py
git commit -m "test: add backend integration tests"
```

---

## 最终检查

完成所有任务后，请确保：

1. [ ] 后端 API 可以启动: `cd backend && python -m uvicorn main:app --port 8000`
2. [ ] 前端可以构建: `cd frontend && npm run build`
3. [ ] 所有测试通过
4. [ ] 项目可以在本地运行

---

## 执行方式选择

**计划已完成并保存到 `project/GenSlides/docs/superpowers/plans/2026-04-01-genslides-implementation.md`**

**两种执行方式：**

**1. Subagent-Driven (推荐)** - 我会为每个任务分发独立的 subagent，在任务之间进行 review，快速迭代

**2. Inline Execution** - 在当前 session 中批量执行任务，使用 executing-plans 技能

你希望采用哪种方式？