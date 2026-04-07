# Critical Fixes — Design Spec
**Date:** 2026-04-08  
**Project:** AI Cost Calculator  
**Scope:** Sub-project A — Bug fixes and user management hardening

---

## 1. Problem Summary

Four categories of issues are addressed in this spec:

1. **Delete project crashes** — `notifications.project_id` and `share_links.project_id` foreign keys lack `ON DELETE CASCADE`, causing `ForeignKeyViolationError` when a project is deleted.
2. **Orphaned projects accumulate** — Projects created via "Start Interview" but abandoned before completing the chat leave zero-feature projects in the DB with no way to bulk-remove them.
3. **User table actions incomplete** — The Settings user management table has no icons on action buttons, no change-password flow, and no visual guard preventing admins from being deleted.
4. **Invite user is non-functional** — The "Invite User" button in Settings exists but is not wired to any form or API.

---

## 2. Fix 1 — Delete Project Cascade

### Root cause
`Notification` and `ShareLink` models reference `projects.id` via FK with no cascade rule. PostgreSQL enforces referential integrity and blocks the `DELETE FROM projects` statement.

### Solution
**One Alembic migration** that:
- Drops the existing FK on `notifications.project_id`, recreates it with `ON DELETE CASCADE`.
- Drops the existing FK on `share_links.project_id`, recreates it with `ON DELETE CASCADE`.

**SQLAlchemy model changes:**
- `Project.notifications` relationship: add `cascade="all, delete-orphan"`, `passive_deletes=True`.
- `Project.share_links` relationship: same.

No endpoint changes needed — the existing `DELETE /api/projects/{id}` endpoint works correctly once the DB constraint is fixed.

---

## 3. Fix 2 — Orphaned Project Cleanup

### Definition
A project is **orphaned** if it has **zero features**. Projects with features but no completed analysis are considered in-progress and are not touched.

### Backend
New admin-only endpoint:

```
DELETE /api/projects/orphaned
Response: { "deleted": N }
```

Selects all projects where `id NOT IN (SELECT DISTINCT project_id FROM features)`, deletes them, and returns the count. Uses a subquery delete to avoid loading rows into Python.

### Frontend — Dashboard
- On load, the Dashboard fetches the project list. If the logged-in user is admin and any project has `feature_count = 0`, show a dismissible amber banner:  
  `"N project(s) have no features and can be cleaned up. [Clean up]"`
- Clicking **Clean up** shows a confirm dialog, then calls `DELETE /api/projects/orphaned` and refreshes the project list.
- Non-admin users never see this banner.

---

## 4. Fix 3 — User Table Icons, Admin Protection, Change Password

### 4.1 Icon buttons
Each row in the user table in Settings gets three `IconButton` components:
- `KeyRound` — change password
- `Pencil` — edit role (existing behaviour, now with icon)
- `Trash2` — delete user

### 4.2 Admin protection
For any user with `role = "admin"`:
- The `Trash2` and `Pencil` buttons are **disabled** (`opacity-40 cursor-not-allowed`).
- Tooltip on hover: `"Admin users cannot be modified"`.

This mirrors the backend guard in `DELETE /api/users/{id}` and `PATCH /api/users/{id}`.

### 4.3 Change password

**New backend endpoints:**

```
PUT /api/users/{id}/password          # admin only
Body: { new_password: string }

PUT /api/users/me/password            # any authenticated user
Body: { current_password: string, new_password: string }
```

Validation: `new_password` minimum 8 characters. `current_password` is bcrypt-verified against the stored hash before update.

**Frontend modal — two variants:**

| Scenario | Fields shown |
|---|---|
| Admin changing another user's password | New password + Confirm |
| User changing own password | Current password + New password + Confirm |

The key icon in the user row opens this modal. The modal is also accessible from a future "My Account" menu (out of scope here).

---

## 5. Fix 4 — Invite User

### 5.1 Backend

**New table: `invite_tokens`**

| Column | Type | Notes |
|---|---|---|
| id | int PK | |
| user_id | int FK → users | the invited user |
| token | varchar(64) | `secrets.token_urlsafe(32)`, unique |
| expires_at | timestamptz | `now() + 24h` |
| used_at | timestamptz | null until redeemed |

**New endpoint:**

```
POST /api/users/invite          # admin only
Body: {
  name: string,
  email: string,
  role: "admin" | "analyst" | "viewer",
  password?: string             # auto-generated 12-char if omitted
}
Response: {
  user: UserOut,
  invite_url: string,           # /login?email=...&token=...
  generated_password: string | null  # only present if auto-generated
}
```

Flow:
1. Create user with provided or auto-generated password.
2. Generate invite token, insert into `invite_tokens`.
3. Build invite URL: `{APP_BASE_URL}/login?email={encoded_email}&token={token}`. `APP_BASE_URL` is a new optional env var (defaults to `http://localhost:5173` if unset).
4. If `SMTP_HOST` is set in env, send welcome email with credentials and link. Email failure is logged but does NOT fail the request.
5. Return response including invite URL and `generated_password` (null if admin provided one).

**New endpoint to redeem token (login page use):**

```
POST /api/auth/redeem-invite
Body: { token: string }
Response: { email: string }     # returns email for pre-fill, burns the token
Errors: 404 if token not found or already used, 410 if expired
```

The token is burned (marked `used_at = now()`) on this call. The login page calls this endpoint once on mount when `?token=` is in the URL to retrieve the email for pre-fill. After redemption, the user logs in normally via `POST /api/auth/login` with their credentials. If the token is expired or already used, the login page shows a warning ("This invite link has expired — please ask an admin to send a new one") but still allows normal login.

### 5.2 Frontend — Invite modal

Clicking **Invite User** opens a modal with:
- **Name** (text)
- **Email** (email)
- **Role** (select: Viewer / Analyst / Admin)
- **Password** (optional — placeholder "Leave blank to auto-generate")

On submit: calls `POST /api/users/invite`. On success, replaces form with a **confirmation panel**:
- Green checkmark + "User created"
- Copyable invite link (`navigator.clipboard.writeText`)
- If `generated_password` is present: shows it in a monospace box with copy button and warning "This password will not be shown again"
- Close button

### 5.3 SMTP configuration

New optional env vars (`.env.example` updated):

```
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@yourcompany.com
SMTP_TLS=true
```

If `SMTP_HOST` is empty, the email step is silently skipped. The Settings page shows an SMTP configuration status badge ("Email sending enabled / disabled") but no full SMTP config form (that is out of scope — env-only config is sufficient for an internal tool).

### 5.4 Login page — token pre-fill

The Login page reads `?email` and `?token` from URL params on mount. If both are present:
- Calls `POST /api/auth/redeem-invite` immediately to burn the token and retrieve the email.
- Pre-fills the email field.
- On success: shows a green banner "You've been invited — enter your password to get started."
- On 404/410 (expired or already used): shows an amber banner "This invite link has expired — please ask an admin for a new one." Email field is still pre-filled from the URL param so the user can log in normally.

---

## 6. Data Model Changes

| Change | Type |
|---|---|
| `notifications.project_id` FK → `ON DELETE CASCADE` | Migration |
| `share_links.project_id` FK → `ON DELETE CASCADE` | Migration |
| `invite_tokens` table | New table + migration |
| `Project.notifications` relationship cascade | Model change |
| `Project.share_links` relationship cascade | Model change |

---

## 7. API Surface Changes

| Method | Path | Auth | New? |
|---|---|---|---|
| DELETE | `/api/projects/orphaned` | admin | New |
| PUT | `/api/users/{id}/password` | admin | New |
| PUT | `/api/users/me/password` | authenticated | New |
| POST | `/api/users/invite` | admin | New |
| POST | `/api/auth/redeem-invite` | public | New |

---

## 8. Out of Scope

- Full SMTP configuration UI (env-only)
- Password reset via email (forgot password flow)
- Invite expiry enforcement beyond the 24h DB check
- Bulk user invite
