# Project: Dashboard Project Switching

## Overview
Add ability to switch the "active project" from Dashboard without navigating away.

## Frontend Changes

### 1. Dashboard Component (`frontend/src/pages/Dashboard.tsx`)
- Add "Switch Project" button next to "New Project" in header
- Add `activeProjectId` state (syncs with localStorage)
- Add query param `?project={id}` support for direct linking

### 2. SwitchProjectModal Component (new)
- Dialog/modal with list of all accessible projects
- Each row shows: name, feature count, budget, Economy/Balanced/Premium costs, updated date
- Click row → sets activeProjectId, Dashboard reloads with selected project data
- Search/filter by project name
- Admin badge indicator for admin-owned projects

### 3. State Management
- Use `localStorage.setItem('activeProjectId', id)` to persist selection
- On mount: read from localStorage, validate project is accessible, fall back to first if not
- Pass `activeProjectId` to analysis queries

## Backend Changes

### 1. New Endpoint (`backend/app/routers/projects.py`)
```
GET /api/my-projects
Response: { projects: ProjectWithDetails[] }
- Admins: all projects
- Regular users: owned + shared via share links
- Each project includes: full analysis bundles, feature count, access_type ("owner" | "shared")
```

### 2. Enhanced Existing Endpoint (`backend/app/routers/projects.py`)
```
GET /api/projects?include_details=true
- Same filtering logic as /api/my-projects
- Returns detailed project data including analysis
```

### 3. Access Filter Logic
```python
# In project listing:
if current_user.role == 'admin':
    projects = all projects
else:
    projects = user's owned projects + projects shared via ShareLink
```

## Data Flow

```
User clicks "Switch Project"
  ↓
Modal opens → GET /api/my-projects
  ↓
Shows list with full details
  ↓
User clicks project row
  ↓
Sets activeProjectId in localStorage
  ↓
Dashboard re-runs queries with project={activeProjectId}
```

## Status
✅ Design approved — ready for implementation
