import pytest
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
from image_generator import ImageGenerator
from slides_manager import SlidesManager
from cost_tracker import CostTracker
from models import ImageProvider


# Python 3.7 兼容的 AsyncMock
class AsyncMock:
    def __init__(self, return_value=None):
        self.return_value = return_value

    async def __call__(self, *args, **kwargs):
        return self.return_value


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

    # Mock MiniMax API 响应
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "data": {"image_url": "https://example.com/image.jpg"}
    }
    # raise_for_status 是一个方法，不需要特殊 mock (MagicMock 默认返回 MagicMock)

    mock_img_response = MagicMock()
    mock_img_response.content = b"fake image bytes"

    # 创建异步mock类 (兼容 Python 3.7)
    class AsyncMockInstance:
        def __init__(self):
            pass

        async def post(self, *args, **kwargs):
            return mock_response

        async def get(self, *args, **kwargs):
            return mock_img_response

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    mock_instance = AsyncMockInstance()

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value = mock_instance

        result = await generator.generate_image(sid, text, ImageProvider.MINIMAX)

    assert result.cached is False
    assert result.hash == manager.compute_text_hash(text)
    assert cost_tracker.minimax_calls == 1
