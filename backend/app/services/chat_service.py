"""
Chat interview service.

Manages conversation state and drives the LLM interview flow:
  1. Greet user, ask about the project
  2. Collect features (user describes them)
  3. Extract structured features from the conversation
  4. Return extracted features for user confirmation

WebSocket message protocol (JSON):
  Client → Server:
    {"type": "message", "text": "..."}
    {"type": "confirm_features"}
    {"type": "reject_features"}

  Server → Client:
    {"type": "token",    "text": "..."}          streaming LLM chunk
    {"type": "done",     "text": "..."}          turn complete, full text
    {"type": "features", "features": [...]}      extracted feature list
    {"type": "error",    "text": "..."}          error message
    {"type": "analysis_ready", "project_id": N} analysis triggered
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from app.llm.base import ChatMessage, LLMAdapter

EXTRACT_SYSTEM_PROMPT = """You are an AI assistant helping extract a structured feature list from a project description conversation.

Given the conversation history, extract all mentioned features as JSON.
Return ONLY valid JSON, no markdown:
{
  "features": [
    {
      "name": "short feature name",
      "description": "one sentence description",
      "category": "qa_chatbot|reasoning_analysis|summarization|code_review|content_generation|code_generation|data_extraction|translation",
      "priority": 1
    }
  ]
}

Priority: 1 = must-have (mentioned as core/critical), 5 = standard, 9 = nice-to-have.
"""

INTERVIEW_SYSTEM_PROMPT = """You are an AI cost estimation assistant conducting a structured interview to understand an AI project.

Your goal: collect enough information to decompose the project into LLM-powered features and estimate token usage.

Interview flow (follow this order):
1. Ask what the project does and its main goal (1 question)
2. Ask the user to list the AI-powered features they need (1 question)
3. Ask about expected daily active users and usage frequency (1 question)
4. Ask about their monthly budget (1 question)
5. Summarise what you've learned and say you'll now extract the features

Rules:
- One question per message
- Be concise and professional
- After the budget question, output exactly: [EXTRACT_FEATURES]
"""


@dataclass
class ConversationState:
    project_id: int
    history: list[ChatMessage] = field(default_factory=list)
    extracted_features: list[dict] = field(default_factory=list)
    turn: int = 0
    done: bool = False


async def process_message(
    state: ConversationState,
    user_text: str,
    llm: LLMAdapter,
    send: callable,  # async send(dict) → None
) -> None:
    """
    Process one user message. Streams tokens back via `send`, then sends
    a `done` event. If the LLM signals feature extraction, extracts and
    sends a `features` event.
    """
    state.history.append(ChatMessage(role="user", content=user_text))

    messages = [ChatMessage(role="system", content=INTERVIEW_SYSTEM_PROMPT)] + state.history

    full_text = ""
    try:
        stream = await llm.chat(messages, stream=True)
        async for chunk in stream:
            full_text += chunk
            await send({"type": "token", "text": chunk})
    except Exception as e:
        await send({"type": "error", "text": str(e)})
        return

    state.history.append(ChatMessage(role="assistant", content=full_text))
    state.turn += 1

    await send({"type": "done", "text": full_text})

    # Check if LLM signalled feature extraction
    if "[EXTRACT_FEATURES]" in full_text:
        await _extract_features(state, llm, send)


async def _extract_features(
    state: ConversationState,
    llm: LLMAdapter,
    send: callable,
) -> None:
    """Run a second LLM call to extract structured features from the conversation."""
    conversation_text = "\n".join(
        f"{m.role.upper()}: {m.content}"
        for m in state.history
        if m.role != "system"
    )
    messages = [
        ChatMessage(role="system", content=EXTRACT_SYSTEM_PROMPT),
        ChatMessage(role="user", content=conversation_text),
    ]
    try:
        raw = await llm.chat(messages, stream=False)
        # Strip markdown fences if present
        raw = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()
        data = json.loads(raw)
        state.extracted_features = data.get("features", [])
        await send({"type": "features", "features": state.extracted_features})
    except Exception as e:
        await send({"type": "error", "text": f"Feature extraction failed: {e}"})
