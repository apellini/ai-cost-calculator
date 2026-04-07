import json
from collections.abc import AsyncGenerator
from pathlib import Path

from app.llm.base import ChatMessage, DecompositionResult, LLMAdapter, SubTaskEstimate

_MOCK_DIR = Path(__file__).parent / "mock_responses"

_CHAT_SCRIPT = [
    "Hello! I'm your AI cost analyst. Let's estimate the cost of your project.\n\nFirst, can you give me a brief description of the project and its main goal?",
    "Great overview! Now, what are the main AI-powered features you plan to build? List them one per line — for example:\n- Customer support chatbot\n- Document summarization\n- Code review assistant",
    "Excellent feature set. For each feature, I'll need to understand the expected usage volume. How many users do you expect per day at peak? And roughly how often will each feature be called per user session?",
    "Got it. One more thing — do you have a monthly budget in mind? This helps me recommend the right cost tier (Economy / Balanced / Premium) and flag any features that may need to be deprioritised.",
    "Perfect. I have everything I need. Let me analyse your requirements and build the cost breakdown...\n\n*Extracting features and estimating token usage...*",
    "Analysis complete! I've identified **8 features** and decomposed each into sub-tasks with realistic token estimates.\n\nHere's a summary:\n- **Economy bundle**: $3,847/mo (within budget)\n- **Balanced bundle**: $8,230/mo (exceeds $5k budget — 2 features excluded)\n- **Premium bundle**: $24,560/mo\n\nSwitch to the **Analysis** tab to see the full breakdown.",
]

_CHAT_INDEX = 0


class MockAdapter(LLMAdapter):
    """
    Returns pre-scripted responses for development and demos.
    No network calls — works fully offline.
    """

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        stream: bool = False,
    ) -> str | AsyncGenerator[str, None]:
        global _CHAT_INDEX
        response = _CHAT_SCRIPT[_CHAT_INDEX % len(_CHAT_SCRIPT)]
        _CHAT_INDEX += 1

        if stream:
            return self._stream_text(response)
        return response

    async def _stream_text(self, text: str) -> AsyncGenerator[str, None]:
        # Yield word by word to simulate streaming
        words = text.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")

    async def decompose_feature(
        self,
        feature_name: str,
        feature_description: str,
        category: str,
    ) -> DecompositionResult:
        responses = json.loads((_MOCK_DIR / "decomposition.json").read_text())
        # Use category-matched mock, fall back to qa_chatbot
        data = responses.get(category, responses["qa_chatbot"])
        sub_tasks = [SubTaskEstimate(**st) for st in data["sub_tasks"]]
        return DecompositionResult(feature_name=feature_name, sub_tasks=sub_tasks)

    async def get_available_models(self) -> list[str]:
        return ["mock-model-1", "mock-model-2"]
