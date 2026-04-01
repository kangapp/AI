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