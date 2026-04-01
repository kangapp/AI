import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query

# 加载 .env 文件
load_dotenv(Path(__file__).parent / ".env")
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
    apiiyi_api_key=os.getenv("APIIYI_API_KEY", "")
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
