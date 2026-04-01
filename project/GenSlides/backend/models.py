from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
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
    total_cost: float = 0.0


class PlaybackSlide(BaseModel):
    sid: str
    text: str
    main_image_url: Optional[str] = None


class PlaybackResponse(BaseModel):
    slides: List[PlaybackSlide]
    start_index: int = 0