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
