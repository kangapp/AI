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
        apiiyi_api_key: Optional[str] = None
    ):
        self.slides_manager = slides_manager
        self.cost_tracker = cost_tracker
        self.minimax_api_key = minimax_api_key or os.getenv("MINIMAX_API_KEY", "")
        self.apiyi_api_key = apiiyi_api_key or os.getenv("APIIYI_API_KEY", "")

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
        # APIYI Gemini Nano Banana Pro 图片生成 API
        # 参考: https://docs.apiyi.com/api-capabilities/nano-banana-image
        if not self.apiyi_api_key:
            raise ValueError("APIIYI_API_KEY must be set")

        url = "https://api.apiyi.com/v1/images/generations"

        headers = {
            "Authorization": f"Bearer {self.apiyi_api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "gemini-nano-banana-pro",
            "prompt": text,
            "image_size": "16:9"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, json=payload)

            print(f"Gemini API response status: {response.status_code}")
            print(f"Gemini API response body: {response.text}")

            response.raise_for_status()
            data = response.json()

            # 解析响应 - APIYI 可能返回不同的格式
            image_url = None
            if "data" in data and isinstance(data["data"], dict):
                image_url = data["data"].get("url") or data["data"].get("image_url")
            elif "image_url" in data:
                image_url = data["image_url"]
            elif "images" in data and len(data["images"]) > 0:
                image_url = data["images"][0].get("url") if isinstance(data["images"][0], dict) else data["images"][0]

            if not image_url:
                raise ValueError(f"Failed to get image URL from response: {data}")

            img_response = await client.get(image_url)
            img_response.raise_for_status()

            with open(output_path, "wb") as f:
                f.write(img_response.content)

    async def _generate_minimax(self, text: str, output_path: Path) -> None:
        # MiniMax Image API
        # 参考: https://platform.minimaxi.com/docs/guides/image-generation
        if not self.minimax_api_key:
            raise ValueError("MINIMAX_API_KEY must be set")

        url = "https://api.minimax.chat/v1/image_generation"

        headers = {
            "Authorization": f"Bearer {self.minimax_api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "image-01",
            "prompt": text,
            "image_size": "16:9"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, json=payload)

            # 打印响应状态和内容用于调试
            print(f"MiniMax API response status: {response.status_code}")
            print(f"MiniMax API response body: {response.text}")

            response.raise_for_status()
            data = response.json()

            # 下载图片
            image_urls = data.get("data", {}).get("image_urls", [])
            image_url = image_urls[0] if image_urls else None
            if not image_url:
                raise ValueError(f"Failed to get image URL from response: {data}")

            img_response = await client.get(image_url)
            img_response.raise_for_status()

            with open(output_path, "wb") as f:
                f.write(img_response.content)
