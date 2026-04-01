# GenSlides 多项目系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现多项目系统，支持创建/管理多个幻灯片项目，每个项目有独立的风格配置

**Architecture:**
- 后端: 扩展 Projects Manager 类，新增 Projects CRUD API，端点路径从 `/api/slides` 变为 `/api/projects/{slug}/slides`
- 前端: 新增 LauncherPage 启动器页面，改造 App.tsx 支持路由，新增项目状态管理
- 存储: 目录从 `slides/` 迁移到 `projects/{slug}/slides/`，新增 `project.yml` 配置文件

**Tech Stack:** Python + FastAPI + TypeScript + Tailwind + Zustand + React Router

---

## 阶段 1: 核心项目系统

### Task 1: 后端 - Projects Manager

**Files:**
- Create: `backend/projects_manager.py`
- Modify: `backend/models.py:1-20` (添加 Project 相关 model)
- Modify: `backend/__init__.py`

- [ ] **Step 1: 添加 Project 数据模型**

在 `models.py` 中添加:

```python
class ProjectStyle(str, Enum):
    PHOTOREALISTIC = "photorealistic"
    ANIME = "anime"
    INK_WASH = "ink-wash"
    CYBERPUNK = "cyberpunk"
    MINIMALIST = "minimalist"
    OIL_PAINTING = "oil-painting"

# 预设风格默认描述
PROJECT_STYLE_DEFAULTS = {
    ProjectStyle.PHOTOREALISTIC: "照片级真实感，高画质",
    ProjectStyle.ANIME: "日系动漫画风，清晰线条",
    ProjectStyle.INK_WASH: "中国传统水墨画风格",
    ProjectStyle.CYBERPUNK: "未来科技感，霓虹灯光",
    ProjectStyle.MINIMALIST: "简洁留白设计",
    ProjectStyle.OIL_PAINTING: "艺术绘画质感",
}

class Project(BaseModel):
    slug: str
    name: str
    style: ProjectStyle
    style_prompt: str = ""  # 用户自定义补充
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def get_full_style(self) -> str:
        """获取完整风格描述 = 预设描述 + 用户自定义"""
        base = PROJECT_STYLE_DEFAULTS.get(self.style, "")
        if self.style_prompt:
            return f"{base}, {self.style_prompt}"
        return base

class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=50)
    style: ProjectStyle
    style_prompt: str = ""

class ProjectListResponse(BaseModel):
    projects: List[Project]
    slide_counts: Dict[str, int] = {}  # slug -> count
    thumbnails: Dict[str, Optional[str]] = {}  # slug -> thumbnail_url
```

- [ ] **Step 2: 创建 ProjectsManager 类**

创建 `backend/projects_manager.py`:

```python
import re
import yaml
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List
from models import Project, ProjectCreate, ProjectStyle

def slugify(name: str) -> str:
    """将项目名称转换为 URL-safe slug"""
    # 转换为小写，替换空格为连字符
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug[:50]  # 限制长度

class ProjectsManager:
    BASE_DIR = Path("projects")

    def __init__(self, base_path: Optional[Path] = None):
        self.base_dir = base_path or self.BASE_DIR
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_project_dir(self, slug: str) -> Path:
        return self.base_dir / slug

    def _get_project_yml_path(self, slug: str) -> Path:
        return self._get_project_dir(slug) / "project.yml"

    def _load_project(self, slug: str) -> Optional[Project]:
        path = self._get_project_yml_path(slug)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            return Project(**data)

    def _save_project(self, project: Project) -> None:
        path = self._get_project_yml_path(project.slug)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(project.model_dump(mode="json"), f, allow_unicode=True, sort_keys=False)

    def _generate_unique_slug(self, base_slug: str) -> str:
        """如果 slug 已存在，添加数字后缀"""
        slug = base_slug
        counter = 2
        while self._get_project_dir(slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        return slug

    def list_projects(self) -> List[Project]:
        """列出所有项目"""
        projects = []
        if not self.base_dir.exists():
            return projects
        for proj_dir in self.base_dir.iterdir():
            if proj_dir.is_dir():
                project = self._load_project(proj_dir.name)
                if project:
                    projects.append(project)
        return sorted(projects, key=lambda p: p.created_at, reverse=True)

    def create_project(self, data: ProjectCreate) -> Project:
        """创建新项目"""
        base_slug = slugify(data.name)
        slug = self._generate_unique_slug(base_slug)

        project = Project(
            slug=slug,
            name=data.name,
            style=data.style,
            style_prompt=data.style_prompt,
            created_at=datetime.now(timezone.utc)
        )

        # 创建目录结构
        project_dir = self._get_project_dir(slug)
        (project_dir / "slides").mkdir(parents=True, exist_ok=True)
        (project_dir / "slides" / "images").mkdir(parents=True, exist_ok=True)

        # 创建空的 outline.yml
        outline_path = project_dir / "slides" / "outline.yml"
        with open(outline_path, "w", encoding="utf-8") as f:
            yaml.dump({"title": data.name, "slides": []}, f, allow_unicode=True, sort_keys=False)

        self._save_project(project)
        return project

    def get_project(self, slug: str) -> Optional[Project]:
        """获取项目详情"""
        return self._load_project(slug)

    def delete_project(self, slug: str) -> bool:
        """删除项目及其所有内容"""
        project_dir = self._get_project_dir(slug)
        if not project_dir.exists():
            return False
        shutil.rmtree(project_dir)
        return True

    def ensure_default_project(self) -> Project:
        """确保 default 项目存在（用于向后兼容）"""
        # 先检查旧数据是否存在
        old_slides_dir = Path("slides")
        old_images_dir = Path("slides/images")
        has_old_data = old_slides_dir.exists() and (old_slides_dir / "outline.yml").exists()

        # 检查 default 项目是否已存在
        default_project = self._load_project("default")
        if default_project:
            return default_project

        # 创建 default 项目
        default_project = Project(
            slug="default",
            name="默认项目",
            style=ProjectStyle.PHOTOREALISTIC,
            style_prompt="",
            created_at=datetime.now(timezone.utc)
        )
        self._save_project(default_project)

        # 迁移旧数据（如果存在）
        if has_old_data:
            default_slides_dir = self.base_dir / "default" / "slides"
            default_slides_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy(old_slides_dir / "outline.yml", default_slides_dir / "outline.yml")
            # 迁移 images
            if old_images_dir.exists():
                default_images_dir = default_slides_dir / "images"
                default_images_dir.mkdir(parents=True, exist_ok=True)
                for item in old_images_dir.iterdir():
                    if item.is_dir():
                        shutil.copytree(item, default_images_dir / item.name, dirs_exist_ok=True)
                    else:
                        shutil.copy(item, default_images_dir / item.name)

        return default_project
```

- [ ] **Step 3: 运行测试验证**

Run: `cd backend && python -c "from projects_manager import ProjectsManager, slugify; print(slugify('我的项目'))"`
Expected: `wo-de-xiang-mu`

- [ ] **Step 4: 提交**

```bash
git add backend/models.py backend/projects_manager.py
git commit -m "feat: add ProjectsManager for multi-project support"
```

---

### Task 2: 后端 - Projects API 端点

**Files:**
- Modify: `backend/main.py:1-20` (添加 imports)
- Modify: `backend/main.py:43-70` (添加 projects endpoints)

- [ ] **Step 1: 添加 Projects API 端点**

在 `main.py` 中添加:

```python
from models import ProjectCreate, ProjectListResponse

# ProjectsManager 实例化 (在 existing slides_manager 之后)
projects_manager = ProjectsManager(base_path=BASE_PATH / "projects")

# 启动时确保 default 项目存在
projects_manager.ensure_default_project()

# === Projects CRUD ===

@app.get("/api/projects", response_model=ProjectListResponse)
async def get_projects():
    """获取所有项目列表"""
    projects = projects_manager.list_projects()

    # 获取每个项目的 slide 数量和缩略图
    slide_counts = {}
    thumbnails = {}
    for project in projects:
        # 使用 public 方法 get_all_slides 获取 slide 数量
        slides_data = slides_manager.get_all_slides(project.slug)
        slide_counts[project.slug] = len(slides_data.slides)

        # 获取第一个 slide 的缩略图
        if slides_data.slides:
            first_slide = slides_data.slides[0]
            text_hash = slides_manager.compute_text_hash(first_slide.text)
            image_path = slides_manager.get_slide_images_dir(first_slide.sid, project.slug) / f"{text_hash}.jpg"
            if image_path.exists():
                thumbnails[project.slug] = f"/api/projects/{project.slug}/thumbnail"

    return ProjectListResponse(
        projects=projects,
        slide_counts=slide_counts,
        thumbnails=thumbnails
    )

@app.post("/api/projects", response_model=dict)
async def create_project(project_data: ProjectCreate):
    """创建新项目"""
    if len(project_data.name) > 50:
        raise HTTPException(status_code=422, detail="Project name must be 50 characters or less")

    project = projects_manager.create_project(project_data)
    return project.model_dump(mode="json")

@app.get("/api/projects/{slug}", response_model=dict)
async def get_project(slug: str):
    """获取项目详情"""
    project = projects_manager.get_project(slug)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.model_dump(mode="json")

@app.delete("/api/projects/{slug}")
async def delete_project(slug: str):
    """删除项目"""
    success = projects_manager.delete_project(slug)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"success": True}

@app.get("/api/projects/{slug}/thumbnail")
async def get_project_thumbnail(slug: str):
    """获取项目缩略图（第一个 slide 的图片）"""
    project = projects_manager.get_project(slug)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    slides_data = slides_manager.get_all_slides(slug)
    if not slides_data.slides:
        raise HTTPException(status_code=404, detail="No slides in project")

    first_slide = slides_data.slides[0]
    text_hash = slides_manager.compute_text_hash(first_slide.text)
    image_path = slides_manager.get_slide_images_dir(first_slide.sid, slug) / f"{text_hash}.jpg"

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    from starlette.responses import FileResponse
    return FileResponse(str(image_path), media_type="image/jpeg")
```

- [ ] **Step 2: 修改 get_slide_images_dir 支持 slug**

```python
def get_slide_images_dir(self, sid: str, slug: str = "default") -> Path:
    path = self.images_dir / slug / sid
    path.mkdir(parents=True, exist_ok=True)
    return path
```

- [ ] **Step 3: 测试 API**

Run: `cd backend && python -c "import main; print('API loaded')"`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add backend/main.py
git commit -m "feat: add Projects CRUD API endpoints"
```

---

### Task 3: 后端 - 修改 Slides API 支持 project slug

**Files:**
- Modify: `backend/main.py` (修改现有 slides endpoints 添加 slug 参数)
- Modify: `backend/slides_manager.py` (修改 get_slide_images_dir 支持 slug)

- [ ] **Step 1: 修改 get_slide_images_dir 方法**

在 `slides_manager.py` 中修改 `get_slide_images_dir` 方法:

```python
# 原方法:
# def get_slide_images_dir(self, sid: str) -> Path:
#     path = self.images_dir / sid
#     path.mkdir(parents=True, exist_ok=True)
#     return path

# 新方法:
def get_slide_images_dir(self, sid: str, slug: str = "default") -> Path:
    """获取 slide 图片目录，支持 project slug"""
    path = self.images_dir / slug / sid
    path.mkdir(parents=True, exist_ok=True)
    return path
```

- [ ] **Step 2: 修改现有 slides endpoints**

将现有 slides endpoints 路径从 `/api/slides` 改为 `/api/projects/{slug}/slides`:

```python
# 旧的 (删除):
# @app.get("/api/slides", response_model=SlideListResponse)
# async def get_slides(slug: str = Query(default="default")):

# 新的:
@app.get("/api/projects/{slug}/slides", response_model=SlideListResponse)
async def get_slides(slug: str):
    return slides_manager.get_all_slides(slug)

@app.post("/api/projects/{slug}/slides", response_model=dict)
async def create_slide(sid: str, slide_data: SlideCreate, slug: str):
    slide = slides_manager.create_slide(slide_data, slug)
    return slide.model_dump(mode="json")

@app.put("/api/projects/{slug}/slides/{sid}", response_model=dict)
async def update_slide(sid: str, slide_data: SlideUpdate, slug: str):
    slide = slides_manager.update_slide(sid, slide_data, slug)
    if slide is None:
        raise HTTPException(status_code=404, detail="Slide not found")
    return slide.model_dump(mode="json")

@app.delete("/api/projects/{slug}/slides/{sid}")
async def delete_slide(sid: str, slug: str):
    success = slides_manager.delete_slide(sid, slug)
    if not success:
        raise HTTPException(status_code=404, detail="Slide not found")
    return {"success": True}

@app.post("/api/projects/{slug}/slides/{sid}/generate", response_model=GenerateResponse)
async def generate_image(
    sid: str,
    request: GenerateRequest = GenerateRequest(),
    slug: str = "default"  # 向后兼容默认值
):
    # 确保 slug 不为 None
    effective_slug = slug or "default"

    slide = slides_manager.get_slide_by_sid(sid, effective_slug)
    if slide is None:
        raise HTTPException(status_code=404, detail="Slide not found")

    return await image_generator.generate_image(
        sid=sid,
        text=slide.text,
        provider=request.provider,
        force=request.force,
        project_slug=effective_slug
    )

@app.get("/api/projects/{slug}/slides/{sid}/images")
async def get_slide_images(sid: str, slug: str):
    images_dir = slides_manager.get_slide_images_dir(sid, slug)
    if not images_dir.exists():
        return {"images": []}

    images = []
    for img_path in images_dir.glob("*.jpg"):
        hash_value = img_path.stem
        images.append(ImageInfo(
            hash=hash_value,
            url=f"/api/images/{slug}/{sid}/{hash_value}",
            cached=True
        ))

    return {"images": images}

@app.get("/api/images/{slug}/{sid}/{hash}")
async def get_image(slug: str, sid: str, hash: str):
    image_path = slides_manager.get_slide_images_dir(sid, slug) / f"{hash}.jpg"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    from starlette.responses import FileResponse
    return FileResponse(str(image_path), media_type="image/jpeg")
```

- [ ] **Step 2: 修改 image_generator 接受 projects_manager 参数**

修改 `ImageGenerator.__init__`:

```python
class ImageGenerator:
    def __init__(
        self,
        slides_manager: SlidesManager,
        cost_tracker: CostTracker,
        projects_manager: ProjectsManager,  # 新增
        minimax_api_key: Optional[str] = None,
        apiiyi_api_key: Optional[str] = None
    ):
        self.slides_manager = slides_manager
        self.cost_tracker = cost_tracker
        self.projects_manager = projects_manager  # 新增
        # ...
```

修改 `generate_image` 方法:

```python
async def generate_image(
    self,
    sid: str,
    text: str,
    provider: ImageProvider = ImageProvider.MINIMAX,
    force: bool = False,
    project_slug: str = "default"
) -> GenerateResponse:
    # ... 现有缓存检查代码 ...

    # 获取项目风格
    project = self.projects_manager.get_project(project_slug)
    style_prompt = project.get_full_style() if project else ""

    # 构建完整 prompt
    full_text = f"{style_prompt}, {text}" if style_prompt else text

    # ... 后续生成代码 ...
```

同时更新 `main.py` 中的 ImageGenerator 实例化:

```python
image_generator = ImageGenerator(
    slides_manager=slides_manager,
    cost_tracker=cost_tracker,
    projects_manager=projects_manager,  # 新增
    minimax_api_key=os.getenv("MINIMAX_API_KEY", ""),
    apiiyi_api_key=os.getenv("APIIYI_API_KEY", "")
)
```

- [ ] **Step 3: 提交**

```bash
git add backend/main.py backend/slides_manager.py backend/image_generator.py
git commit -m "feat: update slides API to use project slug paths"
```

---

### Task 4: 前端 - 路由和 LauncherPage

**Files:**
- Modify: `frontend/package.json` (添加 react-router-dom)
- Modify: `frontend/src/main.tsx` (添加 Router)
- Create: `frontend/src/components/LauncherPage.tsx`
- Create: `frontend/src/components/ProjectCard.tsx`
- Create: `frontend/src/components/CreateProjectModal.tsx`
- Create: `frontend/src/components/DeleteConfirmModal.tsx`
- Create: `frontend/src/pages/ProjectPage.tsx`

- [ ] **Step 1: 安装 react-router-dom**

Run: `cd frontend && npm install react-router-dom@6`

- [ ] **Step 2: 创建 LauncherPage 组件**

创建 `frontend/src/components/LauncherPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectsStore, Project } from '../stores/projectsStore';
import ProjectCard from './ProjectCard';
import CreateProjectModal from './CreateProjectModal';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function LauncherPage() {
  const navigate = useNavigate();
  const { projects, loading, loadProjects, deleteProject } = useProjectsStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = () => {
    setShowCreateModal(true);
  };

  const handleProjectClick = (slug: string) => {
    navigate(`/project/${slug}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setDeleteTarget(project);
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await deleteProject(deleteTarget.slug);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">G</span>
          </div>
          <h1 className="text-2xl font-bold text-white">GenSlides</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-8 py-12">
        {/* Create Button */}
        <div className="mb-10">
          <button
            onClick={handleCreateProject}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建项目
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">还没有项目，点击上方按钮创建一个</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <ProjectCard
                key={project.slug}
                project={project}
                onClick={() => handleProjectClick(project.slug)}
                onDelete={(e) => handleDeleteClick(e, project)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateProjectModal onClose={() => setShowCreateModal(false)} />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建 ProjectCard 组件**

创建 `frontend/src/components/ProjectCard.tsx`:

```tsx
import { Project } from '../stores/projectsStore';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const STYLE_LABELS: Record<string, string> = {
  photorealistic: '写实摄影',
  anime: '动漫/二次元',
  'ink-wash': '水墨/国风',
  cyberpunk: '赛博朋克',
  minimalist: '极简主义',
  'oil-painting': '油画/艺术',
};

export default function ProjectCard({ project, onClick, onDelete }: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-900 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-800 transition-colors group"
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-800 relative">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-600 text-4xl">📷</span>
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-white font-medium truncate">{project.name}</h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {project.slide_count || 0} slides
          </span>
          <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">
            {STYLE_LABELS[project.style] || project.style}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建 CreateProjectModal 组件**

创建 `frontend/src/components/CreateProjectModal.tsx`:

```tsx
import { useState } from 'react';
import { useProjectsStore, ProjectStyle } from '../stores/projectsStore';
import { useNavigate } from 'react-router-dom';

interface CreateProjectModalProps {
  onClose: () => void;
}

const STYLE_OPTIONS = [
  { value: ProjectStyle.PHOTOREALISTIC, label: '写实摄影', desc: '照片级真实感' },
  { value: ProjectStyle.ANIME, label: '动漫/二次元', desc: '日系动漫画风' },
  { value: ProjectStyle.INK_WASH, label: '水墨/国风', desc: '中国传统水墨画风格' },
  { value: ProjectStyle.CYBERPUNK, label: '赛博朋克', desc: '未来科技感' },
  { value: ProjectStyle.MINIMALIST, label: '极简主义', desc: '简洁留白设计' },
  { value: ProjectStyle.OIL_PAINTING, label: '油画/艺术', desc: '艺术绘画质感' },
];

export default function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const navigate = useNavigate();
  const { createProject, isCreating } = useProjectsStore();
  const [name, setName] = useState('');
  const [style, setStyle] = useState<ProjectStyle>(ProjectStyle.PHOTOREALISTIC);
  const [stylePrompt, setStylePrompt] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isCreating) return;

    const project = await createProject({ name: name.trim(), style, style_prompt: stylePrompt.trim() });
    onClose();
    if (project) {
      navigate(`/project/${project.slug}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-white mb-6">创建项目</h2>

        <form onSubmit={handleSubmit}>
          {/* Project Name */}
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

          {/* Style Select */}
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

          {/* Style Prompt */}
          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2">
              自定义描述 <span className="text-gray-600">(可选)</span>
            </label>
            <textarea
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              placeholder="对所选风格的补充说明..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              {isCreating ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 创建 DeleteConfirmModal 组件**

创建 `frontend/src/components/DeleteConfirmModal.tsx`:

```tsx
import { Project } from '../stores/projectsStore';

interface DeleteConfirmModalProps {
  project: Project;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({ project, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-white mb-4">确认删除</h2>

        <p className="text-gray-300 mb-2">
          确定要删除项目 <span className="text-white font-medium">"{project.name}"</span> 吗？
        </p>

        <p className="text-gray-500 text-sm mb-4">
          此操作将删除该项目下的所有内容：
        </p>

        <ul className="text-gray-400 text-sm mb-6 space-y-1">
          <li>- {project.slide_count || 0} 个 slides</li>
          <li>- {project.image_count || 0} 张已生成的图片</li>
        </ul>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 创建 projectsStore**

创建 `frontend/src/stores/projectsStore.ts`:

```tsx
import { create } from 'zustand';

export enum ProjectStyle {
  PHOTOREALISTIC = 'photorealistic',
  ANIME = 'anime',
  INK_WASH = 'ink-wash',
  CYBERPUNK = 'cyberpunk',
  MINIMALIST = 'minimalist',
  OIL_PAINTING = 'oil-painting',
}

export interface Project {
  slug: string;
  name: string;
  style: string;
  style_prompt: string;
  created_at: string;
  slide_count?: number;
  thumbnail_url?: string;
}

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  isCreating: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  createProject: (data: { name: string; style: ProjectStyle; style_prompt: string }) => Promise<Project | null>;
  deleteProject: (slug: string) => Promise<void>;
}

const API_BASE = '/api';

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  loading: false,
  isCreating: false,
  error: null,

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/projects`);
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();

      // 合并 slide_count 和 thumbnail 信息
      const projectsWithMeta = data.projects.map((p: Project) => ({
        ...p,
        slide_count: data.slide_counts?.[p.slug] || 0,
        thumbnail_url: data.thumbnails?.[p.slug] || null,
      }));

      set({ projects: projectsWithMeta, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createProject: async (data) => {
    set({ isCreating: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create project');
      }
      const project = await res.json();
      set(state => ({
        projects: [project, ...state.projects],
        isCreating: false
      }));
      return project;
    } catch (err) {
      set({ error: (err as Error).message, isCreating: false });
      return null;
    }
  },

  deleteProject: async (slug) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${slug}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project');
      set(state => ({
        projects: state.projects.filter(p => p.slug !== slug)
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
```

- [ ] **Step 7: 提交**

```bash
git add frontend/src/components/LauncherPage.tsx frontend/src/components/ProjectCard.tsx
git add frontend/src/components/CreateProjectModal.tsx frontend/src/components/DeleteConfirmModal.tsx
git add frontend/src/stores/projectsStore.ts
git commit -m "feat: add LauncherPage and project management components"
```

---

### Task 5: 前端 - 路由和 App 重构

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/stores/slidesStore.ts`
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: 更新 main.tsx 添加 Router**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

需要添加 import:
```tsx
import { BrowserRouter } from 'react-router-dom';
```

- [ ] **Step 2: 重构 App.tsx 支持路由**

```tsx
import { Routes, Route } from 'react-router-dom';
import LauncherPage from './components/LauncherPage';
import ProjectPage from './pages/ProjectPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LauncherPage />} />
      <Route path="/project/:slug" element={<ProjectPage />} />
    </Routes>
  );
}
```

- [ ] **Step 3: 创建 ProjectPage 组件**

创建 `frontend/src/pages/ProjectPage.tsx`:

```tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSlidesStore } from '../stores/slidesStore';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import MainPreview from '../components/MainPreview';
import FullscreenPlayer from '../components/FullscreenPlayer';

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const { loadSlides, loadCost, cost, isPlaying } = useSlidesStore();

  useEffect(() => {
    if (slug) {
      loadSlides(slug);
      loadCost();
    }
  }, [slug, loadSlides, loadCost]);

  return (
    <div className="min-h-screen bg-gray-950">
      <Header projectSlug={slug} />

      <div className="flex h-[calc(100vh-64px)]">
        <Sidebar projectSlug={slug} />
        <main className="flex-1 p-6 overflow-auto">
          <MainPreview projectSlug={slug} />
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

- [ ] **Step 4: 更新 api.ts 添加 projects API 并修改 slidesApi**

```typescript
// 更新后的 Slides API - 所有方法接受 slug 参数
export const slidesApi = {
  getAll: (slug: string): Promise<SlideListResponse> =>
    fetchJSON(`/projects/${slug}/slides`),

  create: (slug: string, text: string): Promise<Slide> =>
    fetchJSON(`/projects/${slug}/slides`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  update: (slug: string, sid: string, text: string): Promise<Slide> =>
    fetchJSON(`/projects/${slug}/slides/${sid}`, {
      method: 'PUT',
      body: JSON.stringify({ text }),
    }),

  delete: (slug: string, sid: string): Promise<void> =>
    fetch(`${API_BASE}/projects/${slug}/slides/${sid}`, { method: 'DELETE' }).then(r => r.json()),

  generate: (slug: string, sid: string, provider: 'gemini' | 'minimax' = 'minimax', force = false): Promise<GenerateResponse> =>
    fetchJSON(`/projects/${slug}/slides/${sid}/generate`, {
      method: 'POST',
      body: JSON.stringify({ provider, force }),
    }),

  getImages: (slug: string, sid: string): Promise<{ images: ImageInfo[] }> =>
    fetchJSON(`/projects/${slug}/slides/${sid}/images`),
};

// Projects API
export const projectsApi = {
  getAll: (): Promise<{ projects: Project[]; slide_counts: Record<string, number>; thumbnails: Record<string, string> }> =>
    fetchJSON('/projects'),

  create: (data: { name: string; style: string; style_prompt: string }): Promise<Project> =>
    fetchJSON('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (slug: string): Promise<Project> =>
    fetchJSON(`/projects/${slug}`),

  delete: (slug: string): Promise<void> =>
    fetch(`${API_BASE}/projects/${slug}`, { method: 'DELETE' }).then(r => r.json()),
};
```

- [ ] **Step 5: 更新 slidesStore 支持 projectSlug**

```typescript
// 修改 loadSlides 接受 projectSlug 参数
loadSlides: async (projectSlug?: string) => {
  set({ isLoading: true, error: null });
  try {
    const slug = projectSlug || 'default';
    const data = await slidesApi.getAll(slug);
    set({ slides: data.slides, title: data.title, isLoading: false });

    // Auto-select first slide
    if (data.slides.length > 0 && !get().selectedSid) {
      const firstSid = data.slides[0].sid;
      set({ selectedSid: firstSid });
      get().loadImages(firstSid, slug);
    }
  } catch (err) {
    set({ error: (err as Error).message, isLoading: false });
  }
},

// 其他方法也需要更新传递 slug 参数
```

- [ ] **Step 6: 提交**

```bash
git add frontend/src/main.tsx frontend/src/App.tsx frontend/src/api.ts
git commit -m "feat: add routing and ProjectPage"
```

---

## 阶段 2: 风格集成

### Task 6: 前端 - Header 组件改造

**Files:**
- Modify: `frontend/src/components/Header.tsx`

- [ ] **Step 1: 添加返回按钮和项目名称**

```tsx
import { useNavigate } from 'react-router-dom';
import { useProjectsStore } from '../stores/projectsStore';

interface HeaderProps {
  projectSlug?: string;
}

export default function Header({ projectSlug }: HeaderProps) {
  const navigate = useNavigate();
  const { projects } = useProjectsStore();

  const project = projects.find(p => p.slug === projectSlug);
  const projectName = project?.name || projectSlug;

  const handleBack = () => {
    navigate('/');
  };

  const handlePlay = () => {
    useSlidesStore.getState().startPlayback();
  };

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-gray-700 bg-gray-900">
      {/* Left: Back button + Project name */}
      <div className="flex items-center gap-4">
        {projectSlug && (
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h2 className="text-white font-medium truncate max-w-md">
          {projectName || 'GenSlides'}
        </h2>
      </div>

      {/* Right: Play button */}
      <button
        onClick={handlePlay}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        </svg>
        播放
      </button>
    </header>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/Header.tsx
git commit -m "feat: update Header with back button and project name"
```

---

### Task 7: 后端 - 图片生成集成风格

**Files:**
- Modify: `backend/image_generator.py` (注入 projects_manager)
- Modify: `backend/main.py` (传入 projects_manager 到 ImageGenerator)

- [ ] **Step 1: 修改 ImageGenerator 注入 projects_manager**

修改 `backend/image_generator.py` 中的 `__init__` 方法:

```python
# 原 __init__:
# def __init__(self, slides_manager, cost_tracker, ...):

# 新 __init__:
def __init__(
    self,
    slides_manager: SlidesManager,
    cost_tracker: CostTracker,
    projects_manager: ProjectsManager,  # 新增
    minimax_api_key: Optional[str] = None,
    apiiyi_api_key: Optional[str] = None
):
    self.slides_manager = slides_manager
    self.cost_tracker = cost_tracker
    self.projects_manager = projects_manager  # 新增
    self.minimax_api_key = minimax_api_key or os.getenv("MINIMAX_API_KEY", "")
    self.apiyi_api_key = apiiyi_api_key or os.getenv("APIIYI_API_KEY", "")
```

- [ ] **Step 2: 修改 generate_image 方法使用项目风格**

```python
async def generate_image(
    self,
    sid: str,
    text: str,
    provider: ImageProvider = ImageProvider.MINIMAX,
    force: bool = False,
    project_slug: str = "default"
) -> GenerateResponse:
    # ... 现有缓存检查代码 ...

    # 获取项目风格
    project = self.projects_manager.get_project(project_slug)
    style_prompt = project.get_full_style() if project else ""

    # 构建完整 prompt
    full_text = f"{style_prompt}, {text}" if style_prompt else text

    # 调用 API 生成图片
    if provider == ImageProvider.GEMINI:
        await self._generate_gemini(full_text, image_path)
    else:
        await self._generate_minimax(full_text, image_path)
```

- [ ] **Step 3: 更新 main.py 中的 ImageGenerator 实例化**

```python
# 在 main.py 中，ImageGenerator 初始化时传入 projects_manager:
image_generator = ImageGenerator(
    slides_manager=slides_manager,
    cost_tracker=cost_tracker,
    projects_manager=projects_manager,  # 新增
    minimax_api_key=os.getenv("MINIMAX_API_KEY", ""),
    apiiyi_api_key=os.getenv("APIIYI_API_KEY", "")
)
```

- [ ] **Step 4: 提交**

```bash
git add backend/image_generator.py backend/main.py
git commit -m "feat: integrate project style into image generation"
```

---

### Task 8: 前端 - Sidebar 和 MainPreview 支持 project_slug

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/MainPreview.tsx`

- [ ] **Step 1: 修改 Sidebar 组件传递 project_slug**

```tsx
// Sidebar.tsx 需要:
interface SidebarProps {
  projectSlug: string;  // 新增
}

// 所有 API 调用需要传递 projectSlug
const handleCreateSlide = async () => {
  await slidesApi.create(projectSlug, '新幻灯片');
};

// API 调用改为:
slidesApi.getAll(projectSlug)  // 代替 slidesApi.getAll()
slidesApi.create(projectSlug, text)
slidesApi.update(projectSlug, sid, text)
slidesApi.delete(projectSlug, sid)
```

- [ ] **Step 2: 修改 MainPreview 传递 projectSlug 到图片生成**

```tsx
// MainPreview.tsx
interface MainPreviewProps {
  projectSlug: string;  // 新增
}

// generateImage 调用时传递 projectSlug
const handleGenerate = () => {
  if (selectedSid && projectSlug) {
    generateImage(selectedSid, provider, projectSlug);  // 新增参数
  }
};
```

- [ ] **Step 3: 更新 slidesStore 的 generateImage 签名**

```typescript
generateImage: (sid: string, provider?: 'gemini' | 'minimax', projectSlug?: string) => Promise<void>
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/MainPreview.tsx
git commit -m "feat: update Sidebar and MainPreview to support project slug"
```

---

## 任务清单

- [ ] Task 1: 后端 - Projects Manager (含数据模型)
- [ ] Task 2: 后端 - Projects API 端点
- [ ] Task 3: 后端 - 修改 Slides API 支持 project slug
- [ ] Task 4: 前端 - LauncherPage 和项目卡片组件
- [ ] Task 5: 前端 - 路由和 App 重构
- [ ] Task 6: 前端 - Header 组件改造
- [ ] Task 7: 后端 - 图片生成集成风格
- [ ] Task 8: 前端 - Sidebar 和 MainPreview 支持 project_slug

---

## 测试验证

每个任务完成后进行以下验证:

### 后端 API 测试 (Task 2 完成后)

```bash
# 启动后端
cd backend && python -m uvicorn main:app --reload --port 8000

# 测试 Projects API
curl http://localhost:8000/api/projects
# Expected: {"projects": [], "slide_counts": {}, "thumbnails": {}}

# 测试创建项目
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "测试项目", "style": "anime", "style_prompt": ""}'
# Expected: 返回项目对象，包含 slug

# 测试获取项目详情
curl http://localhost:8000/api/projects/ce-shi-xiang-mu
# Expected: 返回项目对象

# 测试向后兼容 (default slug)
curl http://localhost:8000/api/projects/default/slides
# Expected: 返回 slides 列表
```

### 前端功能测试 (Task 5 完成后)

```bash
# 启动前端
cd frontend && npm run dev

# 测试流程:
# 1. 访问 http://localhost:3003 应显示启动器页面
# 2. 点击"创建项目"，填写表单，确认后跳转至 /project/{slug}
# 3. 在项目页面可以添加 slide
# 4. 点击返回按钮回到启动器页面
# 5. 项目列表应显示新建的项目卡片
```

### 完整流程测试 (Task 7 完成后)

```bash
# 1. 创建新项目，选择"动漫/二次元"风格
# 2. 添加 slide，输入文字如"可爱的猫"
# 3. 点击生成图片
# 4. 验证生成的图片使用了动漫风格
```

---

## 注意事项

1. **向后兼容**: 不带 slug 的 API 调用自动使用 `default` 项目
2. **数据迁移**: 首次启动时旧数据自动迁移到 `default` 项目
3. **Slug 生成**: 同名项目自动添加数字后缀
4. **风格组合**: 完整风格 = 预设风格描述 + 用户自定义描述
