import os
import base64
import httpx
from pathlib import Path
from typing import Optional
from models import ImageProvider, GenerateResponse
from cost_tracker import CostTracker
from slides_manager import SlidesManager
from projects_manager import ProjectsManager


class ImageGenerator:
    def __init__(
        self,
        slides_manager: SlidesManager,
        cost_tracker: CostTracker,
        projects_manager: Optional[ProjectsManager] = None,
        minimax_api_key: Optional[str] = None,
        apiiyi_api_key: Optional[str] = None
    ):
        self.slides_manager = slides_manager
        self.cost_tracker = cost_tracker
        self.projects_manager = projects_manager
        self.minimax_api_key = minimax_api_key or os.getenv("MINIMAX_API_KEY", "")
        self.apiyi_api_key = apiiyi_api_key or os.getenv("APIIYI_API_KEY", "")

    async def generate_image(
        self,
        sid: str,
        text: str,
        provider: ImageProvider = ImageProvider.MINIMAX,
        force: bool = False,
        project_slug: str = "default"
    ) -> GenerateResponse:
        text_hash = self.slides_manager.compute_text_hash(text)
        images_dir = self.slides_manager.get_slide_images_dir(sid, project_slug)
        image_path = images_dir / f"{text_hash}.jpg"

        # 检查缓存
        if image_path.exists() and not force:
            return GenerateResponse(
                sid=sid,
                hash=text_hash,
                image_url=f"/api/images/{project_slug}/{sid}/{text_hash}",
                cached=True
            )

        # 获取项目风格并注入到 prompt
        style_prompt = ""
        if self.projects_manager:
            project = self.projects_manager.get_project(project_slug)
            if project:
                style_prompt = project.get_full_style()

        # 构建完整 prompt
        full_text = f"{style_prompt}, {text}" if style_prompt else text

        # 调用 API 生成图片
        if provider == ImageProvider.GEMINI:
            await self._generate_gemini(full_text, image_path)
        else:
            await self._generate_minimax(full_text, image_path)

        # 记录成本
        self.cost_tracker.record_call(provider)

        return GenerateResponse(
            sid=sid,
            hash=text_hash,
            image_url=f"/api/images/{project_slug}/{sid}/{text_hash}",
            cached=False
        )

    async def _generate_gemini(self, text: str, output_path: Path) -> None:
        # APIYI Gemini Nano Banana Pro 图片生成 API
        # 参考: https://docs.apiyi.com/api-capabilities/nano-banana-image
        if not self.apiyi_api_key:
            raise ValueError("APIIYI_API_KEY must be set")

        url = "https://api.apiyi.com/v1beta/models/gemini-3-pro-image-preview:generateContent"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.apiyi_api_key}"
        }

        payload = {
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                "imageConfig": {
                    "aspectRatio": "16:9",
                    "imageSize": "2K"
                }
            }
        }

        async with httpx.AsyncClient(timeout=360.0) as client:
            response = await client.post(url, headers=headers, json=payload)

            print(f"Gemini API response status: {response.status_code}")
            print(f"Gemini API response body: {response.text[:500]}...")

            response.raise_for_status()
            data = response.json()

            # 解析响应 - base64 图片数据
            image_base64 = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]

            # 解码并保存图片
            image_bytes = base64.b64decode(image_base64)
            with open(output_path, "wb") as f:
                f.write(image_bytes)

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

            try:
                data = response.json()
            except (ValueError, Exception) as e:
                raise ValueError(f"Failed to parse JSON response: {response.text}, error: {e}") from e

            if data is None:
                raise ValueError(f"Empty JSON response from MiniMax API: {response.text}")

            # 下载图片
            data_dict = data if isinstance(data, dict) else {}
            data_block = data_dict.get("data") or {}
            image_urls = data_block.get("image_urls", []) if isinstance(data_block, dict) else []
            image_url = image_urls[0] if image_urls and len(image_urls) > 0 else None
            if not image_url:
                raise ValueError(f"Failed to get image URL from response: {data}")

            img_response = await client.get(image_url)
            img_response.raise_for_status()

            with open(output_path, "wb") as f:
                f.write(img_response.content)
