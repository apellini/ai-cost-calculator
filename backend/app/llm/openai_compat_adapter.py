"""
OpenAI-compatible adapter. Works with LM Studio, vLLM, and any server
that implements the /v1/chat/completions endpoint.
"""
import json
from collections.abc import AsyncGenerator

import httpx

from app.llm.base import ChatMessage, DecompositionResult, LLMAdapter, SubTaskEstimate
from app.llm.prompts.decomposition import SYSTEM_PROMPT, build_user_prompt


class OpenAICompatAdapter(LLMAdapter):
    def __init__(self, base_url: str, model: str, api_key: str = ""):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        stream: bool = False,
    ) -> str | AsyncGenerator[str, None]:
        payload = {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": stream,
        }
        if stream:
            return self._stream(payload)
        async with httpx.AsyncClient(timeout=120, headers=self._headers) as client:
            resp = await client.post(f"{self.base_url}/v1/chat/completions", json=payload)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def _stream(self, payload: dict) -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient(timeout=300, headers=self._headers) as client:
            async with client.stream(
                "POST", f"{self.base_url}/v1/chat/completions", json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    data = json.loads(data_str)
                    chunk = data["choices"][0].get("delta", {}).get("content", "")
                    if chunk:
                        yield chunk

    async def decompose_feature(
        self,
        feature_name: str,
        feature_description: str,
        category: str,
    ) -> DecompositionResult:
        messages = [
            ChatMessage(role="system", content=SYSTEM_PROMPT),
            ChatMessage(role="user", content=build_user_prompt(feature_name, feature_description, category)),
        ]
        raw = await self.chat(messages, stream=False)
        data = json.loads(raw)
        sub_tasks = [SubTaskEstimate(**st) for st in data["sub_tasks"]]
        return DecompositionResult(feature_name=feature_name, sub_tasks=sub_tasks)

    async def get_available_models(self) -> list[str]:
        async with httpx.AsyncClient(timeout=10, headers=self._headers) as client:
            resp = await client.get(f"{self.base_url}/v1/models")
            resp.raise_for_status()
            return [m["id"] for m in resp.json().get("data", [])]
