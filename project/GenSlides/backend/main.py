import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from starlette.responses import FileResponse

# 加载 .env 文件
load_dotenv(Path(__file__).parent / ".env")
from fastapi.middleware.cors import CORSMiddleware

from models import (
    SlideCreate, SlideUpdate, GenerateRequest, GenerateResponse,
    SlideListResponse, ImageInfo, CostInfo, PlaybackResponse, PlaybackSlide,
    ProjectCreate, ProjectListResponse
)
from slides_manager import SlidesManager
from projects_manager import ProjectsManager
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
projects_manager = ProjectsManager(base_path=BASE_PATH / "projects")
projects_manager.ensure_default_project()
cost_tracker = CostTracker()
image_generator = ImageGenerator(
    slides_manager=slides_manager,
    cost_tracker=cost_tracker,
    projects_manager=projects_manager,
    minimax_api_key=os.getenv("MINIMAX_API_KEY", ""),
    apiiyi_api_key=os.getenv("APIIYI_API_KEY", "")
)


# === Projects CRUD ===

def _get_project_thumbnail_path(slug: str) -> Optional[Path]:
    """获取项目缩略图路径（第一个 slide 的图片）"""
    slides_data = slides_manager.get_all_slides(slug)
    if not slides_data.slides:
        return None
    first_slide = slides_data.slides[0]
    text_hash = slides_manager.compute_text_hash(first_slide.text)
    return slides_manager.get_slide_images_dir(first_slide.sid, slug) / f"{text_hash}.jpg"


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
        image_path = _get_project_thumbnail_path(project.slug)
        if image_path and image_path.exists():
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

    image_path = _get_project_thumbnail_path(slug)
    if not image_path or not image_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    return FileResponse(str(image_path), media_type="image/jpeg")


# === Slides CRUD ===

@app.get("/api/projects/{slug}/slides", response_model=SlideListResponse)
async def get_slides(slug: str):
    return slides_manager.get_all_slides(slug)


@app.post("/api/projects/{slug}/slides", response_model=dict)
async def create_slide(slug: str, slide_data: SlideCreate):
    slide = slides_manager.create_slide(slide_data, slug)
    return slide.model_dump(mode="json")


@app.put("/api/projects/{slug}/slides/{sid}", response_model=dict)
async def update_slide(slug: str, sid: str, slide_data: SlideUpdate):
    slide = slides_manager.update_slide(sid, slide_data, slug)
    if slide is None:
        raise HTTPException(status_code=404, detail="Slide not found")
    return slide.model_dump(mode="json")


@app.delete("/api/projects/{slug}/slides/{sid}")
async def delete_slide(slug: str, sid: str):
    success = slides_manager.delete_slide(sid, slug)
    if not success:
        raise HTTPException(status_code=404, detail="Slide not found")
    return {"success": True}


# === Image Generation ===

@app.post("/api/projects/{slug}/slides/{sid}/generate", response_model=GenerateResponse)
async def generate_image(
    slug: str,
    sid: str,
    request: GenerateRequest = GenerateRequest()
):
    slide = slides_manager.get_slide_by_sid(sid, slug)
    if slide is None:
        raise HTTPException(status_code=404, detail="Slide not found")

    return await image_generator.generate_image(
        sid=sid,
        text=slide.text,
        provider=request.provider,
        force=request.force,
        project_slug=slug
    )


@app.get("/api/projects/{slug}/slides/{sid}/images")
async def get_slide_images(slug: str, sid: str):
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


# === Image Serving ===

@app.get("/api/images/{slug}/{sid}/{hash}")
async def get_image(slug: str, sid: str, hash: str):
    image_path = slides_manager.get_slide_images_dir(sid, slug) / f"{hash}.jpg"
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(str(image_path), media_type="image/jpeg")


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
        image_path = slides_manager.get_slide_images_dir(slide.sid, slug) / f"{text_hash}.jpg"

        main_url = None
        if image_path.exists():
            main_url = f"/api/images/{slug}/{slide.sid}/{text_hash}"

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
