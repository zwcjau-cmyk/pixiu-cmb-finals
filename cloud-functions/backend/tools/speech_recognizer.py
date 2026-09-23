"""语音识别工具 - 调用豆包语音 ASR 极速版。"""
import base64
import json
import uuid
from typing import Optional

import httpx
from agno.tools import Toolkit

from config import VOLC_ASR_API_KEY, VOLC_ASR_ENDPOINT, VOLC_ASR_RESOURCE_ID


class SpeechRecognizerTool(Toolkit):
    def __init__(self):
        super().__init__(name="speech_recognizer")
        self.register(self.transcribe_audio)

    def transcribe_audio(
        self,
        audio_path: Optional[str] = None,
        audio_base64: Optional[str] = None,
        filename: str = "recording.wav",
        mime_type: str = "audio/wav",
    ) -> str:
        """将 WAV、MP3 或 OGG OPUS 音频转录为文本。"""
        del filename, mime_type
        if not audio_path and not audio_base64:
            return json.dumps({"success": False, "message": "请提供音频。"}, ensure_ascii=False)
        if not VOLC_ASR_API_KEY:
            return json.dumps({
                "success": False,
                "message": "语音识别尚未配置 VOLC_ASR_API_KEY。",
            }, ensure_ascii=False)
        try:
            if audio_path:
                with open(audio_path, "rb") as audio_file:
                    encoded_audio = base64.b64encode(audio_file.read()).decode("ascii")
            else:
                encoded_audio = base64.b64encode(
                    base64.b64decode(audio_base64, validate=True)
                ).decode("ascii")

            response = httpx.post(
                VOLC_ASR_ENDPOINT,
                headers={
                    "Content-Type": "application/json",
                    "X-Api-Key": VOLC_ASR_API_KEY,
                    "X-Api-Resource-Id": VOLC_ASR_RESOURCE_ID,
                    "X-Api-Request-Id": str(uuid.uuid4()),
                    "X-Api-Sequence": "-1",
                },
                json={
                    "user": {"uid": "pixiu-agent"},
                    "audio": {"data": encoded_audio},
                    "request": {
                        "model_name": "bigmodel",
                        "enable_itn": True,
                        "enable_punc": True,
                    },
                },
                timeout=20.0,
            )
            response.raise_for_status()
            api_status = response.headers.get("X-Api-Status-Code", "")
            if api_status and not api_status.startswith("200"):
                raise RuntimeError(
                    response.headers.get("X-Api-Message") or f"ASR 状态码 {api_status}"
                )
            text = response.json().get("result", {}).get("text", "").strip()
            return json.dumps({
                "success": True,
                "text": text,
                "message": "语音识别成功",
            }, ensure_ascii=False)
        except Exception as error:
            return json.dumps({
                "success": False,
                "error": type(error).__name__,
                "message": "语音识别失败，请稍后再试。",
            }, ensure_ascii=False)
