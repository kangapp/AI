import os
import yaml
import uuid
import blake3
from datetime import datetime, timezone
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
            created_at=datetime.now(timezone.utc)
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
