import os
import base64
import httpx
import asyncio
import tempfile
import uuid
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

        # 当 force=True 时使用带 UUID 的文件名，避免覆盖同名缓存
        if force:
            image_hash = f"{text_hash}_{uuid.uuid4().hex[:8]}"
        else:
            image_hash = text_hash

        image_path = images_dir / f"{image_hash}.jpg"

        # 检查缓存 (仅在非 force 模式)
        if image_path.exists() and not force:
            return GenerateResponse(
                sid=sid,
                hash=image_hash,
                image_url=f"/api/images/{project_slug}/{sid}/{image_hash}",
                cached=True
            )

        # 获取项目风格并注入到 prompt
        style_prompt = ""
        style_reference_image = None
        reference_image_base64 = None
        if self.projects_manager:
            project = self.projects_manager.get_project(project_slug)
            if project:
                style_prompt = project.get_full_style()
                style_reference_image = project.style_reference_image
                # 读取参考图并转为 base64
                if style_reference_image:
                    ref_path = self.projects_manager._get_project_dir(project_slug) / style_reference_image
                    if ref_path.exists():
                        with open(ref_path, "rb") as f:
                            ref_base64 = base64.b64encode(f.read()).decode()
                            reference_image_base64 = f"data:image/jpeg;base64,{ref_base64}"

        # 构建完整 prompt
        full_text = f"{style_prompt}, {text}" if style_prompt else text

        # MiniMax API prompt 长度限制为 1500 字符
        MAX_PROMPT_LENGTH = 1500
        if provider == ImageProvider.MINIMAX and len(full_text) > MAX_PROMPT_LENGTH:
            # 优先保留用户文本，截断风格描述
            if style_prompt and len(text) < MAX_PROMPT_LENGTH:
                # 计算可用的风格描述长度
                available = MAX_PROMPT_LENGTH - len(text) - 2  # 减去 ", " 的长度
                truncated_style = style_prompt[:available]
                full_text = f"{truncated_style}, {text}"
            else:
                # 如果文本本身就太长，直接截断
                full_text = text[:MAX_PROMPT_LENGTH]

        # 调用 API 生成图片
        # 如果有参考图，传递给支持参考图的 API
        if provider == ImageProvider.GEMINI and style_reference_image:
            # Gemini 参考图 - 读取文件转为 base64
            ref_path = self.projects_manager._get_project_dir(project_slug) / style_reference_image
            if ref_path.exists():
                with open(ref_path, "rb") as f:
                    ref_base64 = f"data:image/jpeg;base64,{base64.b64encode(f.read()).decode()}"
                await self._generate_gemini_with_reference(full_text, ref_base64, image_path)
            else:
                await self._generate_gemini(full_text, image_path)
        elif provider == ImageProvider.GEMINI:
            await self._generate_gemini(full_text, image_path)
        elif provider == ImageProvider.MINIMAX and reference_image_base64:
            # MiniMax 参考图 - 使用 base64 data URL
            await self._generate_minimax(full_text, image_path, reference_image_base64=reference_image_base64)
        else:
            await self._generate_minimax(full_text, image_path)

        # 记录成本
        self.cost_tracker.record_call(provider)

        return GenerateResponse(
            sid=sid,
            hash=image_hash,
            image_url=f"/api/images/{project_slug}/{sid}/{image_hash}",
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

    async def _generate_gemini_with_reference(
        self,
        text: str,
        reference_image_base64: str,
        output_path: Path
    ) -> None:
        """使用参考图生成 (Gemini 原生支持)"""
        if not self.apiyi_api_key:
            raise ValueError("APIIYI_API_KEY must be set")

        url = "https://api.apiyi.com/v1beta/models/gemini-3-pro-image-preview:generateContent"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.apiyi_api_key}"
        }

        # 解析参考图 base64 (去掉 data:image/jpeg;base64, 前缀)
        ref_data = reference_image_base64.replace("data:image/jpeg;base64,", "")

        payload = {
            "contents": [{
                "parts": [
                    {"text": text},
                    {"inlineData": {"mimeType": "image/jpeg", "data": ref_data}}
                ]
            }],
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
            response.raise_for_status()
            data = response.json()

            image_base64 = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
            image_bytes = base64.b64decode(image_base64)

            with open(output_path, "wb") as f:
                f.write(image_bytes)

    async def _generate_minimax(self, text: str, output_path: Path, reference_image_base64: str = None) -> None:
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
            "aspect_ratio": "16:9",
            "response_format": "base64"
        }

        # 如果有参考图，添加 subject_reference (使用 base64 data URL)
        if reference_image_base64:
            payload["subject_reference"] = [
                {
                    "type": "character",
                    "image_file": reference_image_base64
                }
            ]

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, json=payload)

            # 打印响应状态和内容用于调试
            print(f"MiniMax API response status: {response.status_code}")
            print(f"MiniMax API response body: {response.text[:500]}...")

            response.raise_for_status()

            try:
                data = response.json()
            except (ValueError, Exception) as e:
                raise ValueError(f"Failed to parse JSON response: {response.text}, error: {e}") from e

            if data is None:
                raise ValueError(f"Empty JSON response from MiniMax API: {response.text}")

            # 解析 base64 图片数据
            data_dict = data if isinstance(data, dict) else {}
            image_base64_list = data_dict.get("data", {}).get("image_base64", []) if isinstance(data_dict.get("data"), dict) else []
            image_base64 = image_base64_list[0] if image_base64_list else None

            if not image_base64:
                # 兼容 image_urls 格式
                image_urls = data_dict.get("data", {}).get("image_urls", []) if isinstance(data_dict.get("data"), dict) else []
                image_url = image_urls[0] if image_urls else None
                if image_url:
                    img_response = await client.get(image_url)
                    img_response.raise_for_status()
                    with open(output_path, "wb") as f:
                        f.write(img_response.content)
                else:
                    raise ValueError(f"Failed to get image from response: {data}")
            else:
                image_bytes = base64.b64decode(image_base64)
                with open(output_path, "wb") as f:
                    f.write(image_bytes)

    async def generate_preview_image(
        self,
        style_prompt: str,
        provider: ImageProvider = ImageProvider.MINIMAX,
        max_retries: int = 2
    ) -> Optional[bytes]:
        """生成预览图，返回图片字节数据，失败返回 None"""
        output_path = None
        try:
            for attempt in range(max_retries):
                try:
                    prompt = f"{style_prompt}, abstract texture only, no specific content"
                    output_path = Path(tempfile.gettempdir()) / f"preview_{uuid.uuid4().hex}.jpg"

                    if provider == ImageProvider.GEMINI:
                        await self._generate_gemini(prompt, output_path)
                    else:
                        await self._generate_minimax(prompt, output_path)

                    with open(output_path, "rb") as f:
                        return f.read()
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429 and attempt < max_retries - 1:
                        await asyncio.sleep(2 ** attempt)  # 指数退避
                        continue
                    print(f"Preview generation failed for {provider}: {e}")
                    return None
                except Exception as e:
                    print(f"Preview generation failed for {provider}: {e}")
                    return None
            return None
        finally:
            # 清理临时文件
            if output_path and output_path.exists():
                output_path.unlink()
