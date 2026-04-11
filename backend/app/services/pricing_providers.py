from abc import ABC, abstractmethod
from typing import List, Dict, Any
from dataclasses import dataclass
from datetime import datetime

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

class MockPricingProvider(PricingProvider):
    """
    Mock provider for testing the sync and notification flow.
    Simulates an external API response.
    """
    async def fetch_models(self) -> List[ExternalModelData]:
        # This returns a set of models, some of which should match the DB
        # and some of which should have different prices to test the NOTIFY logic.
        return [
            ExternalModelData(
                slug="gpt-4o",
                display_name="GPT-4o",
                provider_name="OpenAI",
                input_per_1m=5.0, # Assume this might differ from DB
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
        return [] # Benchmarks are bundled in ExternalModelData for simplicity here
