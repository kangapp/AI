from datetime import datetime, timezone
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict, computed_field
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(from_attributes=True)


class SlideListResponse(BaseModel):
    slides: List[Slide]
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

    @computed_field
    @property
    def total_cost(self) -> float:
        return round(self.gemini_cost + self.minimax_cost, 6)


class PlaybackSlide(BaseModel):
    sid: str
    text: str
    main_image_url: Optional[str] = None


class PlaybackResponse(BaseModel):
    slides: List[PlaybackSlide]
    start_index: int = 0


class ProjectStyle(str, Enum):
    PHOTOREALISTIC = "photorealistic"
    ANIME = "anime"
    INK_WASH = "ink-wash"
    CYBERPUNK = "cyberpunk"
    MINIMALIST = "minimalist"
    OIL_PAINTING = "oil-painting"
    CUSTOM = "custom"  # 完全自定义


# 预设风格默认描述
PROJECT_STYLE_DEFAULTS = {
    ProjectStyle.PHOTOREALISTIC: "照片级真实感，高画质",
    ProjectStyle.ANIME: "日系动漫画风，清晰线条",
    ProjectStyle.INK_WASH: "中国传统水墨画风格",
    ProjectStyle.CYBERPUNK: "未来科技感，霓虹灯光",
    ProjectStyle.MINIMALIST: "简洁留白设计",
    ProjectStyle.OIL_PAINTING: "艺术绘画质感",
    ProjectStyle.CUSTOM: "",  # 自定义风格无默认描述
}


class Project(BaseModel):
    slug: str
    name: str
    style: ProjectStyle
    style_prompt: str = ""  # 用户自定义补充
    style_reference_image: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def get_full_style(self) -> str:
        """获取完整风格描述"""
        # 自定义风格：只返回用户输入的描述
        if self.style == ProjectStyle.CUSTOM:
            return self.style_prompt or ""
        # 预设风格：预设描述 + 用户自定义
        base = PROJECT_STYLE_DEFAULTS.get(self.style, "")
        if self.style_prompt:
            return f"{base}, {self.style_prompt}" if base else self.style_prompt
        return base


class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=50)
    style: ProjectStyle
    style_prompt: str = ""
    style_reference_image: Optional[str] = None


class ProjectListResponse(BaseModel):
    projects: List[Project]
    slide_counts: Dict[str, int] = {}  # slug -> count
    thumbnails: Dict[str, Optional[str]] = {}  # slug -> thumbnail_url


class StylePreviewRequest(BaseModel):
    style_prompt: str
