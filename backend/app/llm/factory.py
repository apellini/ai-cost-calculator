from functools import lru_cache

from app.config import get_settings
from app.llm.base import LLMAdapter


@lru_cache
def get_llm_adapter() -> LLMAdapter:
    settings = get_settings()
    backend = settings.llm_backend

    if backend == "mock":
        from app.llm.mock_adapter import MockAdapter
        return MockAdapter()

    if backend == "ollama":
        from app.llm.ollama_adapter import OllamaAdapter
        return OllamaAdapter(base_url=settings.llm_base_url, model=settings.llm_model)

    if backend in ("lmstudio", "openai_compat"):
        from app.llm.openai_compat_adapter import OpenAICompatAdapter
        return OpenAICompatAdapter(
            base_url=settings.llm_base_url,
            model=settings.llm_model,
            api_key=settings.llm_api_key,
        )

    raise ValueError(f"Unknown LLM backend: {backend!r}. Use mock | ollama | lmstudio | openai_compat")
