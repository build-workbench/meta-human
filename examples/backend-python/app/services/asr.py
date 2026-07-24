"""ASR 语音识别服务

仅支持 whisper provider（OpenAI Whisper API，需要 OPENAI_API_KEY）。
"""

import logging
from typing import Optional

import httpx

from app.config import get_settings
from app.exceptions import ASRError

logger = logging.getLogger(__name__)

# 允许的音频 MIME 类型
ALLOWED_AUDIO_TYPES = {
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/ogg",
    "audio/webm",
    "audio/flac",
    "application/octet-stream",
}

MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25MB (Whisper API 限制)


class ASRService:
    def __init__(self) -> None:
        self._settings = get_settings()

    @property
    def provider(self) -> str:
        return self._settings.asr_provider

    @property
    def available(self) -> bool:
        # 仅支持 whisper；本地 faster-whisper 路径已移除
        return self._settings.has_openai_key if self.provider == "whisper" else False

    async def transcribe(
        self,
        audio_data: bytes,
        filename: str = "audio.wav",
        language: Optional[str] = None,
        content_type: str = "audio/wav",
    ) -> dict:
        """语音转文本

        返回: {"text": "识别文本", "language": "zh", "duration": 3.5}
        """
        if not audio_data:
            raise ASRError("音频数据为空")

        if len(audio_data) > MAX_AUDIO_SIZE:
            raise ASRError(f"音频文件过大，最大允许 {MAX_AUDIO_SIZE // (1024 * 1024)}MB")

        language = language or self._settings.asr_language
        provider = self.provider

        if provider == "whisper":
            return await self._transcribe_whisper_api(audio_data, filename, language)
        raise ASRError(f"不支持的 ASR provider: {provider}")

    async def _transcribe_whisper_api(
        self,
        audio_data: bytes,
        filename: str,
        language: str,
    ) -> dict:
        """使用 OpenAI Whisper API 进行语音识别"""
        if not self._settings.has_openai_key:
            raise ASRError("Whisper API 需要配置 OPENAI_API_KEY")

        base_url = self._settings.openai_base_url.rstrip("/")
        url = f"{base_url}/audio/transcriptions"

        headers = {
            "Authorization": f"Bearer {self._settings.openai_api_key}",
        }

        files = {
            "file": (filename, audio_data, "audio/wav"),
        }
        data = {
            "model": self._settings.asr_model,
            "language": language,
            "response_format": "verbose_json",
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, headers=headers, files=files, data=data)
            resp.raise_for_status()
            result = resp.json()

            text = result.get("text", "").strip()
            duration = result.get("duration", 0.0)
            detected_lang = result.get("language", language)

            logger.info(
                "Whisper ASR 识别成功: text=%s, lang=%s, duration=%.1f",
                text[:50],
                detected_lang,
                duration,
            )
            return {
                "text": text,
                "language": detected_lang,
                "duration": duration,
            }
        except httpx.TimeoutException:
            raise ASRError("Whisper API 请求超时")
        except httpx.HTTPStatusError as exc:
            raise ASRError(
                f"Whisper API 请求失败: HTTP {exc.response.status_code}",
                detail={"status": exc.response.status_code, "body": exc.response.text[:500]},
            )
        except Exception as exc:
            logger.exception("Whisper API 调用异常: %s", exc)
            raise ASRError(f"语音识别失败: {exc}")


asr_service = ASRService()
