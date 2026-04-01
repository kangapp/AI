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
