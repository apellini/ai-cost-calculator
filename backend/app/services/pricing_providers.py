from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import httpx
import json

from app.services.encryption import get_decrypted_api_key


@dataclass
class ExternalModelData:
    slug: str
    display_name: str
    provider_name: str
    input_per_1m: float
    output_per_1m: float
    context_window: int
    benchmarks: Dict[str, Any]


class PricingProvider(ABC):
    """
    Abstract Base Class for LLM pricing and benchmark data providers.
    """
    @abstractmethod
    async def fetch_models(self) -> List[ExternalModelData]:
        """Fetch the latest pricing and metadata for all available models."""
        pass

    @abstractmethod
    async def fetch_benchmarks(self) -> List[Dict[str, Any]]:
        """Fetch the latest benchmark scores."""
        pass


# ── Mock Provider ─────────────────────────────────────────────────────────────

class MockPricingProvider(PricingProvider):
    """
    Mock provider for testing the sync and notification flow.
    Simulates an external API response.
    """
    async def fetch_models(self) -> List[ExternalModelData]:
        return [
            ExternalModelData(
                slug="gpt-4o",
                display_name="GPT-4o",
                provider_name="OpenAI",
                input_per_1m=5.0,
                output_per_1m=15.0,
                context_window=128000,
                benchmarks={"mmlu": 88.7, "human_eval": 84.2}
            ),
            ExternalModelData(
                slug="claude-3-5-sonnet",
                display_name="Claude 3.5 Sonnet",
                provider_name="Anthropic",
                input_per_1m=3.0,
                output_per_1m=15.0,
                context_window=200000,
                benchmarks={"mmlu": 88.7, "human_eval": 84.2}
            ),
            ExternalModelData(
                slug="new-experimental-model",
                display_name="Experimental Model",
                provider_name="Unknown",
                input_per_1m=1.0,
                output_per_1m=1.0,
                context_window=32000,
                benchmarks={"mmlu": 50.0, "human_eval": 40.0}
            ),
        ]

    async def fetch_benchmarks(self) -> List[Dict[str, Any]]:
        return []


# ── OpenRouter Provider ───────────────────────────────────────────────────────

class OpenRouterPricingProvider(PricingProvider):
    """
    Pricing provider using the OpenRouter API.

    OpenRouter provides a unified API for multiple LLM providers with pricing data.
    Requires an API key (passed via config).
    """
    BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    @property
    def _headers(self) -> dict:
        if self.api_key:
            return {"Authorization": f"Bearer {self.api_key}"}
        return {}

    async def fetch_models(self) -> List[ExternalModelData]:
        """Fetch models and pricing from OpenRouter API."""
        async with httpx.AsyncClient(headers=self._headers, timeout=30) as client:
            resp = await client.get(f"{self.BASE_URL}/models")
            resp.raise_for_status()
            data = resp.json()

        models = []
        for item in data.get("data", []):
            model_id = item.get("id", "")
            pricing = item.get("pricing", {})
            context_length = item.get("context_length", 128000)

            # Determine provider name from model ID or tags
            provider_name = self._extract_provider(model_id, item)

            models.append(ExternalModelData(
                slug=model_id,
                display_name=item.get("name", model_id),
                provider_name=provider_name,
                input_per_1m=float(pricing.get("input", 0)),
                output_per_1m=float(pricing.get("output", 0)),
                context_window=context_length,
                benchmarks={}
            ))

        return models

    async def fetch_benchmarks(self) -> List[Dict[str, Any]]:
        """OpenRouter doesn't provide benchmarks via API."""
        return []

    def _extract_provider(self, model_id: str, item: dict) -> str:
        """Extract provider name from model ID or tags."""
        tags = item.get("tags", [])
        provider_map = {
            "openai": "OpenAI",
            "anthropic": "Anthropic",
            "google": "Google",
            "meta-llama": "Meta",
            "microsoft": "Microsoft",
            "mistral": "Mistral",
            "groq": "Groq",
        }
        for tag in tags:
            if tag in provider_map:
                return provider_map[tag]
        # Default to OpenRouter for routed models
        return "OpenRouter"


# ── LiteLLM Provider ──────────────────────────────────────────────────────────

class LiteLLMPricingProvider(PricingProvider):
    """
    Pricing provider using LiteLLM's public pricing data.

    Fetches pricing from the LiteLLM GitHub repository (no API key required).
    """
    # Direct URL to LiteLLM's model_prices_and_context_window.json
    PRICING_URL = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"

    async def fetch_models(self) -> List[ExternalModelData]:
        """Fetch pricing data from LiteLLM's public JSON file."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(self.PRICING_URL)
            resp.raise_for_status()
            pricing_data = resp.json()

        models = []
        for model_id, config in pricing_data.items():
            if not isinstance(config, dict):
                continue

            # Extract pricing - LiteLLM uses different key names
            input_cost_per_token = config.get("input_cost_per_token", 0)
            output_cost_per_token = config.get("output_cost_per_token", 0)

            # Convert to per-1M tokens
            input_per_1m = input_cost_per_token * 1_000_000
            output_per_1m = output_cost_per_token * 1_000_000

            context_window = config.get("max_context_window", 128000)

            # Extract provider from model ID prefix
            provider_name = self._extract_provider(model_id)

            # Display name is usually the same as ID, or we can extract it
            display_name = model_id

            models.append(ExternalModelData(
                slug=model_id,
                display_name=display_name,
                provider_name=provider_name,
                input_per_1m=input_per_1m,
                output_per_1m=output_per_1m,
                context_window=context_window,
                benchmarks={}
            ))

        return models

    async def fetch_benchmarks(self) -> List[Dict[str, Any]]:
        """LiteLLM doesn't provide benchmarks via this source."""
        return []

    def _extract_provider(self, model_id: str) -> str:
        """Extract provider name from model ID."""
        provider_prefixes = {
            "gpt-": "OpenAI",
            "claude-": "Anthropic",
            "gemini-": "Google",
            "llama-": "Meta",
            "mistral-": "Mistral",
            "codestral-": "Mistral",
            "command-": "Cohere",
            "babbage-": "OpenAI",
            "davinci-": "OpenAI",
        }
        for prefix, provider in provider_prefixes.items():
            if model_id.startswith(prefix):
                return provider
        return "Unknown"


# ── Individual Provider APIs ──────────────────────────────────────────────────

class OpenAIPricingProvider(PricingProvider):
    """
    Pricing provider for OpenAI models.

    Note: OpenAI doesn't provide a public pricing API. This provider
    uses hardcoded pricing that should be periodically updated.
    For dynamic pricing, use OpenRouterPricingProvider instead.
    """
    # OpenAI pricing as of 2024-10 (hardcoded - update periodically)
    PRICING = {
        "gpt-4o": {"input": 5.00, "output": 15.00, "context": 128000},
        "gpt-4o-mini": {"input": 0.150, "output": 0.600, "context": 128000},
        "gpt-4-turbo": {"input": 10.00, "output": 30.00, "context": 128000},
        "gpt-4": {"input": 30.00, "output": 60.00, "context": 8192},
        "gpt-3.5-turbo": {"input": 0.50, "output": 1.50, "context": 16385},
    }

    async def fetch_models(self) -> List[ExternalModelData]:
        models = []
        for slug, pricing in self.PRICING.items():
            models.append(ExternalModelData(
                slug=slug,
                display_name=slug.upper().replace("-", " "),
                provider_name="OpenAI",
                input_per_1m=pricing["input"],
                output_per_1m=pricing["output"],
                context_window=pricing["context"],
                benchmarks={}
            ))
        return models

    async def fetch_benchmarks(self) -> List[Dict[str, Any]]:
        return []


class AnthropicPricingProvider(PricingProvider):
    """
    Pricing provider for Anthropic models.
    Uses hardcoded pricing - update periodically.
    """
    PRICING = {
        "claude-3-5-sonnet": {"input": 3.00, "output": 15.00, "context": 200000},
        "claude-3-opus": {"input": 15.00, "output": 75.00, "context": 200000},
        "claude-3-haiku": {"input": 0.25, "output": 1.25, "context": 200000},
    }

    async def fetch_models(self) -> List[ExternalModelData]:
        models = []
        for slug, pricing in self.PRICING.items():
            models.append(ExternalModelData(
                slug=slug,
                display_name=slug.replace("-", " ").title(),
                provider_name="Anthropic",
                input_per_1m=pricing["input"],
                output_per_1m=pricing["output"],
                context_window=pricing["context"],
                benchmarks={}
            ))
        return models

    async def fetch_benchmarks(self) -> List[Dict[str, Any]]:
        return []


class GooglePricingProvider(PricingProvider):
    """
    Pricing provider for Google Vertex AI / Gemini models.
    Uses hardcoded pricing - update periodically.
    """
    PRICING = {
        "gemini-1.5-pro": {"input": 3.50, "output": 10.50, "context": 1048576},
        "gemini-1.5-flash": {"input": 0.35, "output": 1.05, "context": 1048576},
        "gemini-1.0-pro": {"input": 0.50, "output": 1.50, "context": 30720},
    }

    async def fetch_models(self) -> List[ExternalModelData]:
        models = []
        for slug, pricing in self.PRICING.items():
            models.append(ExternalModelData(
                slug=slug,
                display_name=slug.replace("-", " ").title(),
                provider_name="Google",
                input_per_1m=pricing["input"],
                output_per_1m=pricing["output"],
                context_window=pricing["context"],
                benchmarks={}
            ))
        return models

    async def fetch_benchmarks(self) -> List[Dict[str, Any]]:
        return []
