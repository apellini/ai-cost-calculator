# Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix delete-project crash, add orphaned-project cleanup, add user table icons + change-password + admin protection, and wire up the invite user flow with optional email.

**Architecture:** Seven backend tasks (migration, models, config, schemas, endpoints) followed by five frontend tasks (api client, Dashboard banner, Settings user table rewrite, two new modal components, Login invite pre-fill). Each task is independently deployable.

**Tech Stack:** FastAPI 0.111+, SQLAlchemy 2.0 async, Alembic, Pydantic v2, React 18, TypeScript, TanStack Query v5, lucide-react.

---

## File Map

**Create:**
- `backend/migrations/versions/0004_cascade_fks_invite_tokens.py`
- `backend/app/models/invite_token.py`
- `backend/app/services/email_service.py`
- `frontend/src/components/ChangePasswordModal.tsx`
- `frontend/src/components/InviteUserModal.tsx`

**Modify:**
- `backend/app/models/project.py` — add `notifications` + `share_links` relationships
- `backend/app/models/__init__.py` — export `InviteToken`
- `backend/app/config.py` — add SMTP + `app_base_url`
- `backend/app/schemas/auth.py` — add password-change + invite schemas
- `backend/app/routers/projects.py` — add `DELETE /orphaned` (must be before `/{project_id}`)
- `backend/app/routers/users.py` — add password-change + invite endpoints (static paths before dynamic)
- `backend/app/routers/auth.py` — add `POST /redeem-invite`
- `backend/app/main.py` — include users router before projects router to avoid `me` vs `{user_id}` conflict (already fine; double-check order)
- `frontend/src/lib/api.ts` — add invite, changePassword, deleteOrphaned, redeemInvite
- `frontend/src/pages/Dashboard.tsx` — orphaned banner (admin only)
- `frontend/src/pages/Settings.tsx` — user table icons, delete wiring, modals
- `frontend/src/pages/Login.tsx` — invite token pre-fill

---

## Task 1: DB Migration — fix cascade FKs + create invite_tokens

**Files:**
- Create: `backend/migrations/versions/0004_cascade_fks_invite_tokens.py`

- [ ] **Step 1: Create the migration file**

```python
# backend/migrations/versions/0004_cascade_fks_invite_tokens.py
"""fix cascade fks and add invite_tokens

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-08
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fix notifications.project_id — add ON DELETE CASCADE
    op.drop_constraint("notifications_project_id_fkey", "notifications", type_="foreignkey")
    op.create_foreign_key(
        "notifications_project_id_fkey",
        "notifications", "projects",
        ["project_id"], ["id"],
        ondelete="CASCADE",
    )

    # Fix share_links.project_id — add ON DELETE CASCADE
    op.drop_constraint("share_links_project_id_fkey", "share_links", type_="foreignkey")
    op.create_foreign_key(
        "share_links_project_id_fkey",
        "share_links", "projects",
        ["project_id"], ["id"],
        ondelete="CASCADE",
    )

    # Create invite_tokens table
    op.create_table(
        "invite_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_invite_tokens_token", "invite_tokens", ["token"])


def downgrade() -> None:
    op.drop_index("ix_invite_tokens_token", table_name="invite_tokens")
    op.drop_table("invite_tokens")

    op.drop_constraint("notifications_project_id_fkey", "notifications", type_="foreignkey")
    op.create_foreign_key(
        "notifications_project_id_fkey",
        "notifications", "projects",
        ["project_id"], ["id"],
    )

    op.drop_constraint("share_links_project_id_fkey", "share_links", type_="foreignkey")
    op.create_foreign_key(
        "share_links_project_id_fkey",
        "share_links", "projects",
        ["project_id"], ["id"],
    )
```

- [ ] **Step 2: Apply migration on dev machine (or VM)**

```bash
cd backend && source .venv/bin/activate
alembic upgrade head
```

Expected output: `Running upgrade 0003 -> 0004, fix cascade fks and add invite_tokens`

- [ ] **Step 3: Verify constraints in psql**

```bash
psql $DATABASE_URL -c "
SELECT tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc USING (constraint_name)
WHERE tc.table_name IN ('notifications','share_links')
  AND tc.constraint_type = 'FOREIGN KEY';
"
```

Expected: both `notifications_project_id_fkey` and `share_links_project_id_fkey` show `CASCADE` in `delete_rule`.

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/versions/0004_cascade_fks_invite_tokens.py
git commit -m "feat: migration 0004 — cascade FKs on notifications/share_links + invite_tokens table"
```

---

## Task 2: SQLAlchemy models — InviteToken + Project relationships

**Files:**
- Create: `backend/app/models/invite_token.py`
- Modify: `backend/app/models/project.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Create InviteToken model**

```python
# backend/app/models/invite_token.py
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
```

- [ ] **Step 2: Add notifications and share_links relationships to Project**

Open `backend/app/models/project.py`. The current relationships block ends at line 42 with:
```python
    scenarios: Mapped[list["Scenario"]] = relationship(back_populates="project", cascade="all, delete-orphan")
```

Add two more relationships after it:

```python
    # In Project class, after scenarios relationship:
    notifications: Mapped[list["Notification"]] = relationship(  # type: ignore[name-defined]
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    share_links: Mapped[list["ShareLink"]] = relationship(  # type: ignore[name-defined]
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
```

- [ ] **Step 3: Export InviteToken from models/__init__.py**

```python
# backend/app/models/__init__.py  — add to existing imports:
from app.models.invite_token import InviteToken  # noqa: F401

# Add to __all__:
"InviteToken",
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/invite_token.py backend/app/models/project.py backend/app/models/__init__.py
git commit -m "feat: add InviteToken model, cascade relationships on Project"
```

---

## Task 3: Config — SMTP + app_base_url

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 1: Add new settings fields**

In `backend/app/config.py`, add after `cors_origins`:

```python
    # Invite links base URL (used to build /login?token=... links)
    app_base_url: str = "http://localhost:5173"

    # SMTP (optional — leave smtp_host empty to disable email sending)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@example.com"
    smtp_tls: bool = True
```

- [ ] **Step 2: Update .env.example**

Add to the project root `.env.example` (create if missing):

```
# Invite link base URL — set to your VM's public URL
APP_BASE_URL=http://localhost:5173

# SMTP — leave SMTP_HOST empty to disable email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@yourcompany.com
SMTP_TLS=true
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/config.py .env.example
git commit -m "feat: add app_base_url and SMTP config settings"
```

---

## Task 4: Auth schemas — password change + invite

**Files:**
- Modify: `backend/app/schemas/auth.py`

- [ ] **Step 1: Add new schemas**

Append to `backend/app/schemas/auth.py`:

```python
from pydantic import field_validator


class PasswordChangeAdmin(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class PasswordChangeSelf(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class InviteCreate(BaseModel):
    email: EmailStr
    name: str
    role: str = "analyst"
    password: str | None = None  # auto-generated 12-char random if None


class InviteResponse(BaseModel):
    user: UserOut
    invite_url: str
    generated_password: str | None = None  # present only when auto-generated
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/auth.py
git commit -m "feat: add password-change and invite schemas"
```

---

## Task 5: Email service

**Files:**
- Create: `backend/app/services/email_service.py`

- [ ] **Step 1: Create email_service.py**

```python
# backend/app/services/email_service.py
"""
Optional SMTP email sending. Does nothing if SMTP_HOST is not configured.
All send failures are logged as warnings — never raise to callers.
"""
import logging
import smtplib
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_invite_email(
    to_email: str,
    to_name: str,
    invite_url: str,
    password: str,
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_password: str,
    smtp_from: str,
    smtp_tls: bool,
) -> None:
    """Send invite email. No-op if smtp_host is empty."""
    if not smtp_host:
        return
    body = (
        f"Hi {to_name},\n\n"
        f"You've been invited to AI Cost Calculator.\n\n"
        f"Login URL: {invite_url}\n"
        f"Password:  {password}\n\n"
        f"This invite link expires in 24 hours.\n"
        f"After signing in you can change your password in Settings.\n"
    )
    msg = MIMEText(body)
    msg["Subject"] = "Your AI Cost Calculator Invite"
    msg["From"] = smtp_from
    msg["To"] = to_email
    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            if smtp_tls:
                server.starttls()
            if smtp_user:
                server.login(smtp_user, smtp_password)
            server.send_message(msg)
        logger.info("Invite email sent to %s", to_email)
    except Exception as exc:
        logger.warning("Failed to send invite email to %s: %s", to_email, exc)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/email_service.py
git commit -m "feat: add optional SMTP email service"
```

---

## Task 6: Backend — orphaned projects endpoint

**Files:**
- Modify: `backend/app/routers/projects.py`

- [ ] **Step 1: Add the orphaned delete endpoint**

Open `backend/app/routers/projects.py`. Add this **before** the `DELETE /{project_id}` endpoint (important: static path must precede dynamic path):

```python
# Add to imports at top of file:
from pydantic import BaseModel as PydanticModel

class OrphanedDeleteOut(PydanticModel):
    deleted: int


@router.delete("/orphaned", response_model=OrphanedDeleteOut)
async def delete_orphaned_projects(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Delete all projects that have no features (abandoned mid-interview)."""
    from sqlalchemy import not_
    subq = select(Feature.project_id).distinct()
    result = await db.execute(
        select(Project).where(Project.id.not_in(subq))
    )
    orphaned = result.scalars().all()
    count = len(orphaned)
    for p in orphaned:
        await db.delete(p)
    await db.commit()
    return OrphanedDeleteOut(deleted=count)
```

Also add `User` and `require_admin` to the imports if not already present:
```python
from app.auth.dependencies import get_current_user, require_admin
from app.models.user import User
```

- [ ] **Step 2: Verify routing order**

Check that in `projects.py` the route order is:
1. `GET /` (list)
2. `POST /` (create)
3. `DELETE /orphaned`  ← new, must be before /{project_id}
4. `GET /{project_id}`
5. `PATCH /{project_id}`
6. `DELETE /{project_id}`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/projects.py
git commit -m "feat: DELETE /api/projects/orphaned endpoint for admin cleanup"
```

---

## Task 7: Backend — password change + invite endpoints

**Files:**
- Modify: `backend/app/routers/users.py`
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1: Add password-change and invite endpoints to users.py**

Replace the full content of `backend/app/routers/users.py` with:

```python
import secrets
import urllib.parse
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_admin
from app.auth.password import hash_password, verify_password
from app.config import get_settings
from app.database import get_db
from app.models.invite_token import InviteToken
from app.models.user import User
from app.schemas.auth import (
    InviteCreate, InviteResponse,
    PasswordChangeAdmin, PasswordChangeSelf,
    UserCreate, UserOut, UserUpdate,
)
from app.services.email_service import send_invite_email

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ── Static paths must come before /{user_id} ─────────────────────────────────

@router.post("/invite", response_model=InviteResponse, status_code=201)
async def invite_user(
    body: InviteCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Create a user and return a one-time invite URL (+ optional email)."""
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    generated_password: str | None = None
    if body.password:
        raw_password = body.password
    else:
        raw_password = secrets.token_urlsafe(9)  # ~12 printable chars
        generated_password = raw_password

    user = User(
        email=body.email,
        name=body.name,
        hashed_password=hash_password(raw_password),
        role=body.role,
    )
    db.add(user)
    await db.flush()

    token = secrets.token_urlsafe(32)
    invite = InviteToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(invite)
    await db.commit()
    await db.refresh(user)

    settings = get_settings()
    invite_url = (
        f"{settings.app_base_url}/login"
        f"?email={urllib.parse.quote(body.email)}"
        f"&token={token}"
    )

    send_invite_email(
        to_email=body.email,
        to_name=body.name,
        invite_url=invite_url,
        password=raw_password,
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_password=settings.smtp_password,
        smtp_from=settings.smtp_from,
        smtp_tls=settings.smtp_tls,
    )

    return InviteResponse(
        user=UserOut.model_validate(user),
        invite_url=invite_url,
        generated_password=generated_password,
    )


@router.put("/me/password", status_code=204)
async def change_own_password(
    body: PasswordChangeSelf,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Authenticated user changes their own password."""
    if not verify_password(body.current_password, current.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current.hashed_password = hash_password(body.new_password)
    await db.commit()


# ── Dynamic path /{user_id} ───────────────────────────────────────────────────

@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin),
):
    if user_id == current.id and body.role and body.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.put("/{user_id}/password", status_code=204)
async def change_user_password(
    user_id: int,
    body: PasswordChangeAdmin,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin resets any user's password without requiring the old one."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(require_admin),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin users cannot be deleted")
    await db.delete(user)
    await db.commit()
```

- [ ] **Step 2: Add redeem-invite endpoint to auth.py**

Add to `backend/app/routers/auth.py`:

```python
# Add to imports:
from pydantic import BaseModel as PydanticModel
from sqlalchemy import select
from app.models.invite_token import InviteToken


class RedeemRequest(PydanticModel):
    token: str

class RedeemResponse(PydanticModel):
    email: str


@router.post("/redeem-invite", response_model=RedeemResponse)
async def redeem_invite(body: RedeemRequest, db: AsyncSession = Depends(get_db)):
    """
    Validate and burn a one-time invite token.
    Returns the invited user's email for pre-filling the login form.
    Raises 404 if not found/already used, 410 if expired.
    """
    now = datetime.now(UTC).replace(tzinfo=None)
    invite = await db.scalar(
        select(InviteToken).where(InviteToken.token == body.token)
    )
    if not invite or invite.used_at is not None:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    if invite.expires_at < now:
        raise HTTPException(status_code=410, detail="Invite link has expired")

    user = await db.get(User, invite.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    invite.used_at = now
    await db.commit()

    return RedeemResponse(email=user.email)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/users.py backend/app/routers/auth.py
git commit -m "feat: add invite, change-password, redeem-invite endpoints"
```

---

## Task 8: Frontend — api.ts additions

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add new TypeScript interfaces**

In `frontend/src/lib/api.ts`, add after the existing `UserOut` interface:

```typescript
export interface InviteCreate {
  email: string
  name: string
  role: 'admin' | 'analyst' | 'viewer'
  password?: string
}

export interface InviteResponse {
  user: UserOut
  invite_url: string
  generated_password: string | null
}
```

- [ ] **Step 2: Expand the users API object**

Replace:
```typescript
  users: {
    list: () => request<UserOut[]>('/api/users'),
  },
```
With:
```typescript
  users: {
    list: () => request<UserOut[]>('/api/users'),
    invite: (body: InviteCreate) =>
      request<InviteResponse>('/api/users/invite', { method: 'POST', body: JSON.stringify(body) }),
    changePassword: (userId: number, newPassword: string) =>
      request<void>(`/api/users/${userId}/password`, {
        method: 'PUT',
        body: JSON.stringify({ new_password: newPassword }),
      }),
    changeOwnPassword: (currentPassword: string, newPassword: string) =>
      request<void>('/api/users/me/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      }),
    delete: (userId: number) =>
      request<void>(`/api/users/${userId}`, { method: 'DELETE' }),
  },
```

- [ ] **Step 3: Add redeemInvite to auth section and deleteOrphaned to projects**

In the `api` object, find the auth section. It currently doesn't exist as a named key — authentication is done via `AuthContext`. Add a new key:

```typescript
  // Auth utilities
  authUtils: {
    redeemInvite: (token: string) =>
      request<{ email: string }>('/api/auth/redeem-invite', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
  },
```

In the projects section, add after the existing `delete`:
```typescript
    deleteOrphaned: () =>
      request<{ deleted: number }>('/api/projects/orphaned', { method: 'DELETE' }),
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add invite, changePassword, deleteOrphaned, redeemInvite to api client"
```

---

## Task 9: Frontend — Dashboard orphaned banner

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add orphaned cleanup banner**

In `Dashboard.tsx`, find the imports and add `useMutation` if not already imported. Then find the component body and add:

```typescript
// At top of Dashboard component, after existing queries:
const { user: currentUser } = useAuth()

const orphanedCount = projects.filter(p => p.feature_count === 0).length

const cleanupMutation = useMutation({
  mutationFn: api.projects.deleteOrphaned,
  onSuccess: (data) => {
    qc.invalidateQueries({ queryKey: ['projects'] })
    alert(`Removed ${data.deleted} orphaned project(s).`)
  },
})
```

Add import at top of file: `import { useAuth } from '@/contexts/AuthContext'`

- [ ] **Step 2: Add banner JSX**

Inside the Dashboard return, just before the project list (after the header section), add:

```tsx
{currentUser?.role === 'admin' && orphanedCount > 0 && (
  <div className="mx-6 mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
    <span className="text-amber-700">
      <strong>{orphanedCount}</strong> project{orphanedCount > 1 ? 's have' : ' has'} no features and can be cleaned up.
    </span>
    <button
      onClick={() => {
        if (confirm(`Delete ${orphanedCount} orphaned project(s)? This cannot be undone.`)) {
          cleanupMutation.mutate()
        }
      }}
      disabled={cleanupMutation.isPending}
      className="text-xs font-medium text-amber-700 hover:text-amber-900 underline ml-4"
    >
      {cleanupMutation.isPending ? 'Cleaning up…' : 'Clean up'}
    </button>
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: Dashboard orphaned projects cleanup banner for admins"
```

---

## Task 10: Frontend — ChangePasswordModal component + Settings wiring

**Files:**
- Create: `frontend/src/components/ChangePasswordModal.tsx`
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Create ChangePasswordModal.tsx**

```tsx
// frontend/src/components/ChangePasswordModal.tsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound, X, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, type UserOut } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  target: UserOut           // the user whose password is being changed
  onClose: () => void
}

export default function ChangePasswordModal({ target, onClose }: Props) {
  const { user: currentUser } = useAuth()
  const isSelf = currentUser?.id === target.id

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [done, setDone]           = useState(false)
  const [err, setErr]             = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      isSelf
        ? api.users.changeOwnPassword(currentPw, newPw)
        : api.users.changePassword(target.id, newPw),
    onSuccess: () => setDone(true),
    onError: (e: Error) => setErr(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (newPw !== confirmPw) { setErr('Passwords do not match'); return }
    if (newPw.length < 8)    { setErr('Password must be at least 8 characters'); return }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-[#4f7dff]" />
            <h2 className="text-sm font-display font-600 text-[#0f1117]">
              {isSelf ? 'Change Your Password' : `Reset Password — ${target.email}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-[#9099b0] hover:text-[#0f1117]"><X size={16} /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-green-600">
            <Check size={28} />
            <p className="text-sm font-medium">Password updated</p>
            <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {isSelf && (
              <div>
                <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Current Password</label>
                <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">New Password</label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Confirm Password</label>
              <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
            </div>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
                Save
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the User Management section of Settings.tsx**

Replace the entire `{/* User Management */}` section in `frontend/src/pages/Settings.tsx` (lines 169–223) with:

```tsx
{/* User Management */}
<section>
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-xs font-mono uppercase tracking-wider text-[#9099b0]">User Management</h2>
    <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
      <Plus size={13} /> Invite User
    </Button>
  </div>
  <Card>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-black/7 bg-[#f8f9fb]">
          <th className="text-left px-5 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">User</th>
          <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Role</th>
          <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Last Active</th>
          <th className="text-right px-4 py-3 text-xs font-mono uppercase tracking-wider text-[#9099b0]">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-black/5">
        {users.map(u => {
          const roleConf = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.viewer
          const RoleIcon = roleConf.icon
          const isAdmin = u.role === 'admin'
          return (
            <tr key={u.id} className="hover:bg-[#f8f9fb] transition-colors">
              <td className="px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4f7dff]/30 to-[#a855f7]/30 flex items-center justify-center text-[10px] font-bold text-[#4f7dff]">
                    {u.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#0f1117]">{u.name || u.email}</div>
                    <div className="text-[10px] text-[#9099b0]">{u.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge variant={roleConf.variant}><RoleIcon size={9} /> {roleConf.label}</Badge>
              </td>
              <td className="px-4 py-3 text-right text-xs text-[#6b7380]">
                {u.last_active_at ? formatRelative(u.last_active_at) : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <button
                    title="Change password"
                    onClick={() => setChangePwTarget(u)}
                    className="p-1.5 rounded text-[#9099b0] hover:text-[#4f7dff] hover:bg-[#4f7dff]/8 transition-colors"
                  >
                    <KeyRound size={13} />
                  </button>
                  <button
                    title={isAdmin ? 'Admin users cannot be deleted' : 'Delete user'}
                    disabled={isAdmin}
                    onClick={() => !isAdmin && deleteMutation.mutate(u.id)}
                    className={`p-1.5 rounded transition-colors ${
                      isAdmin
                        ? 'text-[#d1d5de] cursor-not-allowed'
                        : 'text-[#9099b0] hover:text-red-500 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </Card>
</section>

{changePwTarget && (
  <ChangePasswordModal
    target={changePwTarget}
    onClose={() => setChangePwTarget(null)}
  />
)}

{inviteOpen && (
  <InviteUserModal
    onClose={() => setInviteOpen(false)}
    onSuccess={() => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setInviteOpen(false)
    }}
  />
)}
```

- [ ] **Step 3: Add state + imports + delete mutation to Settings.tsx**

At the top of the `Settings` component, add:

```typescript
// New state
const [changePwTarget, setChangePwTarget] = useState<UserOut | null>(null)
const [inviteOpen, setInviteOpen] = useState(false)

// Delete user mutation
const deleteMutation = useMutation({
  mutationFn: api.users.delete,
  onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
})
```

Add imports to the top of Settings.tsx:
```typescript
import { KeyRound } from 'lucide-react'           // add to existing lucide import
import { type UserOut } from '@/lib/api'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import InviteUserModal from '@/components/InviteUserModal'
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChangePasswordModal.tsx frontend/src/pages/Settings.tsx
git commit -m "feat: Settings user table icons, change-password modal, admin protection"
```

---

## Task 11: Frontend — InviteUserModal component

**Files:**
- Create: `frontend/src/components/InviteUserModal.tsx`

- [ ] **Step 1: Create InviteUserModal.tsx**

```tsx
// frontend/src/components/InviteUserModal.tsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { UserPlus, X, Copy, Check, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, type InviteResponse } from '@/lib/api'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function InviteUserModal({ onClose, onSuccess }: Props) {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [role,     setRole]     = useState<'analyst' | 'viewer' | 'admin'>('analyst')
  const [password, setPassword] = useState('')
  const [result,   setResult]   = useState<InviteResponse | null>(null)
  const [copied,   setCopied]   = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.users.invite({ name, email, role, password: password || undefined }),
    onSuccess: (data) => { setResult(data); onSuccess() },
  })

  const copyLink = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.invite_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-[#4f7dff]" />
            <h2 className="text-sm font-display font-600 text-[#0f1117]">Invite User</h2>
          </div>
          <button onClick={onClose} className="text-[#9099b0] hover:text-[#0f1117]"><X size={16} /></button>
        </div>

        {result ? (
          /* ── Success panel ── */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
              <Check size={16} /> User <strong>{result.user.email}</strong> created
            </div>

            {result.generated_password && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium mb-2">
                  <AlertCircle size={12} /> Auto-generated password — shown once only
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-amber-200 rounded px-3 py-1.5 text-sm font-mono text-[#0f1117]">
                    {result.generated_password}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.generated_password!)}
                    className="text-amber-600 hover:text-amber-800 p-1"
                    title="Copy password"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}

            <div>
              <div className="text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Invite Link (valid 24h)</div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={result.invite_url}
                  className="flex-1 bg-[#f2f4f8] border border-black/10 rounded-lg px-3 py-2 text-xs font-mono text-[#6b7380] truncate"
                />
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1 text-xs text-[#4f7dff] hover:text-[#3a6ae0] font-medium px-3 py-2 rounded-lg border border-[#4f7dff]/25 bg-[#4f7dff]/5 transition-colors"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Name</label>
                <Input placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Email</label>
                <Input type="email" placeholder="jane@company.io" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(['viewer', 'analyst', 'admin'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`px-3 py-2 rounded-lg text-xs capitalize text-center transition-all ${
                      role === r
                        ? 'bg-[#4f7dff]/10 text-[#0f1117] border border-[#4f7dff]/25 font-medium'
                        : 'bg-white text-[#6b7380] border border-black/10 hover:bg-black/3'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">
                Password <span className="text-[#9099b0] normal-case">(leave blank to auto-generate)</span>
              </label>
              <Input
                type="password"
                placeholder="Auto-generated if blank"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {mutation.isError && (
              <p className="text-xs text-red-600">{(mutation.error as Error).message}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                Send Invite
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/InviteUserModal.tsx
git commit -m "feat: InviteUserModal with form, credential display, and copyable link"
```

---

## Task 12: Frontend — Login invite token pre-fill

**Files:**
- Modify: `frontend/src/pages/Login.tsx`

- [ ] **Step 1: Replace Login.tsx with invite-aware version**

```tsx
// frontend/src/pages/Login.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Zap, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login } = useAuth()

  const urlEmail = searchParams.get('email') ?? ''
  const urlToken = searchParams.get('token') ?? ''

  const [email,    setEmail]    = useState(urlEmail || 'admin@example.com')
  const [password, setPassword] = useState(urlEmail ? '' : 'admin1234')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [inviteBanner, setInviteBanner] = useState<'pending' | 'valid' | 'expired' | null>(
    urlToken ? 'pending' : null
  )

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard'

  // Redeem invite token on mount (if present)
  useEffect(() => {
    if (!urlToken) return
    api.authUtils.redeemInvite(urlToken)
      .then(data => {
        setEmail(data.email)
        setInviteBanner('valid')
      })
      .catch(err => {
        setInviteBanner('expired')
        // Still pre-fill email from URL if token is expired
        if (urlEmail) setEmail(urlEmail)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f2f4f8] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#4f7dff]/6 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-[#a855f7]/4 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm px-4 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4f7dff] to-[#a855f7] flex items-center justify-center mb-4 shadow-lg shadow-[#4f7dff]/20">
            <Zap size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-display font-700 text-[#0f1117]">AI Cost Calculator</h1>
          <p className="text-sm text-[#6b7380] mt-1">Internal tool · v0.1</p>
        </div>

        {/* Invite banners */}
        {inviteBanner === 'valid' && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs">
            <CheckCircle size={13} /> You've been invited — enter your password to get started.
          </div>
        )}
        {inviteBanner === 'expired' && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
            <AlertCircle size={13} /> This invite link has expired. Ask an admin to send a new one.
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-black/10 bg-white p-6 shadow-md">
          <h2 className="text-base font-display font-600 text-[#0f1117] mb-5">Sign in</h2>

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Email</label>
              <Input
                type="email"
                placeholder="you@company.io"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#6b7380] mb-1.5 font-mono uppercase tracking-wider">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full mt-5" disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {!urlToken && (
          <p className="text-center text-xs text-[#9099b0] mt-4">
            Default: <span className="text-[#6b7380] font-mono">admin@example.com / admin1234</span>
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Login.tsx
git commit -m "feat: Login invite token pre-fill with valid/expired banners"
```

---

## Task 13: Deploy & verify

- [ ] **Step 1: Push all commits**

```bash
cd /Users/aldo.pellini/Repo/ai-cost-calculator
git push
```

- [ ] **Step 2: Deploy on VM**

```bash
cd /opt/ai-cost-calculator && git pull

# Run new migration
cd backend && source .venv/bin/activate
alembic upgrade head
# Expected: Running upgrade 0003 -> 0004

# Restart backend
sudo systemctl restart aicost-backend

# Rebuild frontend
cd ../frontend && npm run build
```

- [ ] **Step 3: Smoke tests**

```bash
# Test delete project works
curl -X DELETE http://localhost:8000/api/projects/1 \
  -H "Authorization: Bearer <token>"
# Expected: 204 No Content (no FK error)

# Test orphaned endpoint
curl -X DELETE http://localhost:8000/api/projects/orphaned \
  -H "Authorization: Bearer <admin-token>"
# Expected: {"deleted": N}

# Test change own password
curl -X PUT http://localhost:8000/api/users/me/password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"admin1234","new_password":"newpass123"}'
# Expected: 204 No Content

# Test invite
curl -X POST http://localhost:8000/api/users/invite \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","role":"analyst"}'
# Expected: 201 with user, invite_url, generated_password
```

- [ ] **Step 4: Browser verify**

1. Navigate to `/settings` → user table shows KeyRound + Trash2 icons
2. Admin row → both icons disabled/greyed
3. Click KeyRound on a non-admin → ChangePasswordModal opens
4. Click "Invite User" → InviteUserModal opens, fill form, submit → shows invite link + auto-password
5. Open invite link in incognito → Login pre-fills email, shows green banner
6. Dashboard (admin) → if orphaned projects exist, amber banner appears with "Clean up" button
