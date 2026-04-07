from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field


@dataclass
class SubTaskEstimate:
    name: str
    category: str
    reasoning: str
    system_prompt_tokens: int
    input_context_tokens: int
    output_tokens: int
    interaction_rounds: int
    worst_case_multiplier: float


@dataclass
class DecompositionResult:
    feature_name: str
    sub_tasks: list[SubTaskEstimate] = field(default_factory=list)


@dataclass
class ChatMessage:
    role: str  # system | user | assistant
    content: str


class LLMAdapter(ABC):
    """
    Pluggable LLM interface. All adapters must implement these three methods.
    """

    @abstractmethod
    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        stream: bool = False,
    ) -> str | AsyncGenerator[str, None]:
        """
        Send a chat conversation and return the assistant reply.
        If stream=True, returns an async generator yielding text chunks.
        """

    @abstractmethod
    async def decompose_feature(
        self,
        feature_name: str,
        feature_description: str,
        category: str,
    ) -> DecompositionResult:
        """
        Ask the LLM to break a feature into sub-tasks with token estimates.
        Returns a structured DecompositionResult.
        """

    @abstractmethod
    async def get_available_models(self) -> list[str]:
        """Return model names available on this backend."""
