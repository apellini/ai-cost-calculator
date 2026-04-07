"""
WebSocket chat endpoint.

Connect: ws://host/ws/chat/{project_id}

Message flow:
  1. On connect → server sends opening greeting
  2. Client sends {"type": "message", "text": "..."}
  3. Server streams tokens then sends {"type": "done"}
  4. After feature extraction → {"type": "features", "features": [...]}
  5. Client sends {"type": "confirm_features"} → saves features, sends {"type": "analysis_ready"}

Note: DB sessions are created inline rather than via Depends() because FastAPI
may finalize generator dependencies before the WebSocket handler loop completes.
"""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import AsyncSessionLocal
from app.llm.base import ChatMessage
from app.llm.factory import get_llm_adapter
from app.models.project import Feature, Project
from app.services.chat_service import ConversationState, process_message

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

_sessions: dict[int, ConversationState] = {}

GREETING = (
    "Hi! I'm your AI cost analyst. I'll ask you a few questions to understand "
    "what you're building, then generate a detailed cost breakdown.\n\n"
    "First — what does your project do and what's its main goal?"
)


@router.websocket("/ws/chat/{project_id}")
async def chat_ws(project_id: int, websocket: WebSocket):
    await websocket.accept()

    llm = get_llm_adapter()

    if project_id not in _sessions:
        _sessions[project_id] = ConversationState(project_id=project_id)

    state = _sessions[project_id]

    async def send(msg: dict) -> None:
        await websocket.send_text(json.dumps(msg))

    try:
        # Send greeting on first connect
        if state.turn == 0 and not state.history:
            state.history.append(ChatMessage(role="assistant", content=GREETING))
            await send({"type": "done", "text": GREETING})

        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "message":
                await process_message(state, data.get("text", ""), llm, send)

            elif msg_type == "confirm_features":
                async with AsyncSessionLocal() as db:
                    await _save_features(project_id, state, db)
                _sessions.pop(project_id, None)
                await send({"type": "analysis_ready", "project_id": project_id})

            elif msg_type == "reject_features":
                state.extracted_features = []
                await send({
                    "type": "done",
                    "text": "No problem! Let's refine the list. Can you tell me more about the features you need?",
                })

    except WebSocketDisconnect:
        logger.debug("WebSocket disconnected: project=%d", project_id)
    except Exception as exc:
        logger.exception("WebSocket error: project=%d error=%s", project_id, exc)
        try:
            await send({"type": "error", "text": "Connection error. Please refresh and try again."})
        except Exception:
            pass


async def _save_features(project_id: int, state: ConversationState, db) -> None:
    project = await db.get(Project, project_id)
    if not project:
        return

    for i, f in enumerate(state.extracted_features):
        feature = Feature(
            project_id=project_id,
            name=f.get("name", "Unnamed Feature"),
            description=f.get("description"),
            category=f.get("category", "qa_chatbot"),
            priority=int(f.get("priority", 5)),
            order=i,
        )
        db.add(feature)

    project.status = "ready"
    await db.commit()
