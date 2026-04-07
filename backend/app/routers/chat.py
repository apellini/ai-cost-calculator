"""
WebSocket chat endpoint.

Connect: ws://host/ws/chat/{project_id}

Message flow:
  1. On connect → server sends opening greeting (streamed)
  2. Client sends {"type": "message", "text": "..."}
  3. Server streams tokens then sends {"type": "done"}
  4. After 4th user turn → server extracts features, sends {"type": "features", ...}
  5. Client sends {"type": "confirm_features"} → server saves features + triggers analysis
  6. Server sends {"type": "analysis_ready", "project_id": N}
"""
import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.llm.factory import get_llm_adapter
from app.llm.base import ChatMessage
from app.models.project import Feature, Project, SubTask
from app.services.chat_service import ConversationState, process_message

router = APIRouter(tags=["chat"])

# In-memory session store (keyed by project_id).
# Replace with Redis in production for multi-process deployments.
_sessions: dict[int, ConversationState] = {}

GREETING = (
    "Hi! I'm your AI cost analyst. I'll ask you a few questions to understand "
    "what you're building, then generate a detailed cost breakdown.\n\n"
    "First — what does your project do and what's its main goal?"
)


@router.websocket("/ws/chat/{project_id}")
async def chat_ws(
    project_id: int,
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db),
):
    await websocket.accept()

    llm = get_llm_adapter()

    # Get or create session state
    if project_id not in _sessions:
        _sessions[project_id] = ConversationState(project_id=project_id)

    state = _sessions[project_id]

    async def send(msg: dict) -> None:
        await websocket.send_text(json.dumps(msg))

    # Send greeting on first connect
    if state.turn == 0 and not state.history:
        state.history.append(ChatMessage(role="assistant", content=GREETING))
        await send({"type": "done", "text": GREETING})

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "message":
                await process_message(state, data.get("text", ""), llm, send)

            elif msg_type == "confirm_features":
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
        pass


async def _save_features(
    project_id: int,
    state: ConversationState,
    db: AsyncSession,
) -> None:
    """Persist extracted features (without sub-tasks — pipeline handles decomposition)."""
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
