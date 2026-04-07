# AI Cost Calculator -- Design Specification

**Date**: 2026-04-07
**Status**: Draft
**Audience**: Internal team tool

---

## 1. Overview

A web application that helps the team forecast AI usage costs for projects. Users describe their project (via chat interview or markdown spec upload), and the system analyzes requirements, classifies tasks, estimates token usage, maps tasks to optimal LLM models, and produces detailed cost breakdowns with bundle recommendations.

### Goals
- Accurate, worst-case cost estimation for AI-powered features
- Model recommendations based on capability benchmarks and pricing
- Budget-aware optimization that prioritizes quality over coverage
- Historical snapshots for tracking pricing changes over time

---

## 2. Domain Model

### LLMProvider
- `id`, `name` (OpenAI, Anthropic, Google, Meta, Mistral, etc.)
- `api_base_url`, `status` (active/inactive)

### LLMModel
- `id`, `provider_id`, `name`, `version`
- **Pricing**: `input_price_per_1m`, `output_price_per_1m`, `cached_input_price`, `batch_price_per_1m`
- **Volume discounts**: `free_tier_tokens`, `volume_tiers` (JSON: threshold -> discount %)
- **Capabilities**: benchmark scores stored in related `ModelBenchmark` table
- **Task fit**: scored suitability per task category (derived from benchmarks)
- `status`: `active`, `deprecated`, `removed`
- `last_refreshed_at`

### TaskCategory
Pre-defined categories used as **sanity-check bounds** for the LLM-driven token decomposition (not as primary estimation source):

| Category | Token Floor | Token Ceiling | Notes |
|---|---|---|---|
| code_generation | 3,000 | 150,000 | Per feature, includes iteration |
| code_review | 2,000 | 50,000 | Depends on codebase size |
| summarization | 1,000 | 30,000 | Depends on document length |
| data_extraction | 2,000 | 80,000 | Schema complexity varies |
| qa_chatbot | 500 | 10,000 | Per interaction session |
| content_generation | 1,000 | 60,000 | Depends on output length |
| reasoning_analysis | 2,000 | 100,000 | Complex chains can be large |
| translation | 1,000 | 40,000 | Proportional to source |
| image_generation | 200 | 5,000 | Prompt-only (no output tokens) |
| embeddings | 500 | 20,000 | Batch size dependent |

These bounds are configurable in the database. Estimates outside bounds trigger a review flag.

### Project
- `id`, `name`, `description`, `budget` (optional), `created_at`
- Has many `Feature`, `Scenario`, `Snapshot`

### Feature
- `id`, `project_id`, `name`, `description`
- `task_category_id` (auto-classified, user can override)
- `priority` (1-5, for budget optimization)
- `total_input_tokens`, `total_output_tokens` (aggregated from sub-tasks)
- `forced_model_id` (optional -- user override)
- `sanity_check_status`: `ok`, `below_floor`, `above_ceiling`

### SubTask
- `id`, `feature_id`, `name`, `task_category_id`
- `system_prompt_tokens`, `input_context_tokens`, `output_tokens`
- `interaction_rounds`, `worst_case_multiplier`
- `reasoning` (LLM's explanation of the estimate)
- `total_tokens` (computed)

### Bundle
- `id`, `name`, `tier` (economy/balanced/premium/custom)
- Maps each task category to a specific model
- `total_estimated_cost`
- Factors in volume discounts, batch pricing, cached input pricing

### Scenario
- `id`, `project_id`, `name`
- References a `Bundle` + set of `Feature` assignments
- `total_cost`, `budget_utilization_pct`
- Used for side-by-side comparison

### Snapshot
- `id`, `project_id`, `created_at`
- Deep copy of pricing, benchmarks, and bundle assignments at point-in-time
- Immutable once created; user can trigger a new snapshot with refreshed data

---

## 3. User Flow

### 3.1 Chat Interview (primary path)
1. User starts a new project
2. Local LLM initiates conversation: asks about the project, its goals, features needed
3. LLM extracts features iteratively, confirming with the user
4. LLM asks about model preferences and budget constraints
5. Conversation produces a structured feature list

### 3.2 Markdown Upload (alternative entry)
1. User pastes or uploads a markdown spec document
2. LLM parses the spec and extracts a feature list
3. LLM asks clarifying follow-up questions if features are ambiguous
4. Converges to the same structured feature list

### 3.3 Analysis & Results
1. Each feature is auto-classified into a task category (user can override)
2. Token estimation runs: LLM decomposes each feature into sub-tasks and estimates tokens per sub-task (see Section 5)
3. System generates three bundles: Economy, Balanced, Premium
4. Cost table displayed with per-feature and per-model breakdowns
5. If budget is set and insufficient:
   - Knapsack optimization selects highest-priority features within budget
   - Warning shows which features are excluded and the cost gap
   - Cost-reduction suggestions (batch pricing, caching, cheaper models)

### 3.4 User Modifications
- Force a specific model on any feature (recalculates tokens for that model's characteristics)
- Adjust feature priorities
- Create multiple scenarios with different configurations
- Compare scenarios side-by-side

### 3.5 Snapshots
- User can snapshot current analysis (freezes pricing + benchmarks)
- Historical snapshots are immutable and viewable
- User can refresh and create a new snapshot to see price changes over time

---

## 4. Technical Architecture

### Stack
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.0, Alembic
- **Frontend**: React 18+, TypeScript, Vite
- **Database**: PostgreSQL 16
- **LLM**: Pluggable adapter (Ollama, LM Studio, OpenAI-compatible)

### Architecture Diagram

```
React SPA (Vite)
    │
    ├── REST API (analysis, models, projects, snapshots)
    ├── WebSocket (chat streaming)
    │
FastAPI Backend
    │
    ├── Chat Router (WebSocket)
    │       └── LLM Adapter Layer
    │             ├── OllamaAdapter
    │             ├── LMStudioAdapter
    │             └── OpenAICompatAdapter
    │
    ├── Analysis Engine
    │       ├── FeatureExtractor (LLM-powered)
    │       ├── TaskClassifier (LLM + rule-based)
    │       ├── TokenEstimator (LLM decomposition + sanity bounds)
    │       ├── BundleGenerator (optimization logic)
    │       └── BudgetOptimizer (knapsack algorithm)
    │
    ├── Data Refresh Service
    │       ├── PricingFetcher (OpenRouter, LiteLLM, provider APIs)
    │       ├── BenchmarkFetcher (LMSYS, HuggingFace, Artificial Analysis)
    │       ├── ModelStatusTracker
    │       └── APScheduler (in-app managed, configurable intervals)
    │
    └── PostgreSQL
```

### LLM Adapter Interface

```python
class LLMAdapter(ABC):
    async def chat(self, messages: list[Message], stream: bool = False) -> AsyncIterator[str] | str
    async def analyze(self, prompt: str) -> StructuredResponse
    def get_available_models(self) -> list[str]
```

Configuration via environment variables or admin settings:
- `LLM_BACKEND`: ollama | lmstudio | openai_compat
- `LLM_BASE_URL`: e.g., http://localhost:11434
- `LLM_MODEL`: e.g., llama3.1:8b

### API Endpoints (key routes)

```
# Projects
POST   /api/projects
GET    /api/projects/{id}
GET    /api/projects

# Chat
WS     /api/chat/{project_id}

# Features
GET    /api/projects/{id}/features
PUT    /api/projects/{id}/features/{fid}
POST   /api/projects/{id}/features/extract   (from markdown)

# Analysis
POST   /api/projects/{id}/analyze
GET    /api/projects/{id}/bundles
POST   /api/projects/{id}/scenarios
GET    /api/projects/{id}/scenarios/compare

# Models
GET    /api/models
GET    /api/models/{id}
POST   /api/models/refresh

# Snapshots
POST   /api/projects/{id}/snapshots
GET    /api/projects/{id}/snapshots
GET    /api/projects/{id}/snapshots/{sid}

# Auth
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout

# Users (admin)
GET    /api/users
POST   /api/users
PUT    /api/users/{id}
DELETE /api/users/{id}

# Export
GET    /api/projects/{id}/export/pdf
GET    /api/projects/{id}/export/csv
GET    /api/projects/{id}/export/json
POST   /api/projects/{id}/share       (generate shareable link)

# Timeline
GET    /api/projects/{id}/timeline

# Admin / Settings
GET    /api/settings/refresh-schedule
PUT    /api/settings/refresh-schedule
```

---

## 5. Token Estimation Engine

### Approach: LLM-Driven Decomposition

Token estimation is **not based on fixed averages**. Instead, the local LLM performs a structured decomposition of each feature into sub-tasks, estimating tokens at the sub-task level. Category baselines exist only as sanity-check bounds (floor/ceiling), not as the primary estimation source.

### Estimation Process

**Step 1: Feature Decomposition**
The local LLM breaks each feature into concrete sub-tasks. For example, a "user authentication" feature might decompose to:
- Design auth flow (reasoning task)
- Generate login/register endpoints (code generation)
- Generate JWT middleware (code generation)
- Write input validation (code generation)
- Review and fix security issues (code review, 2 iterations)
- Write tests (code generation)

**Step 2: Per-Sub-Task Token Estimation**
For each sub-task, the LLM estimates:
- **System prompt tokens**: size of the instruction/persona prompt needed
- **Input context tokens**: code, specs, or data the model needs to read
- **Output tokens**: expected response size (generated code, analysis, etc.)
- **Interaction rounds**: number of back-and-forth exchanges (refinement, bug fixing)
- **Worst-case multiplier**: applied to account for retries and failures (always >= 1.5)

**Step 3: Aggregation Formula**

```
For each sub-task s within feature f:

  sub_task_tokens(s) = (system_prompt(s) + input_context(s) + output(s))
                       x interaction_rounds(s)
                       x worst_case_multiplier(s)

total_tokens(f) = SUM(sub_task_tokens(s)) for all s in f

For cost calculation with model m:

  input_tokens(f)  = SUM((system_prompt(s) + input_context(s)) x interaction_rounds(s) x worst_case_multiplier(s))
  output_tokens(f) = SUM(output(s) x interaction_rounds(s) x worst_case_multiplier(s))

  cost(f, m) = (input_tokens(f) x price_per_input(m))
             + (output_tokens(f) x price_per_output(m))
```

**Step 4: Sanity Check**
Category baselines serve as bounds:
- If estimated tokens fall below category floor -> flag as potentially underestimated
- If estimated tokens exceed category ceiling -> flag for review
- These bounds are configurable per category in the database

### LLM Decomposition Prompt Structure
The local LLM receives a structured prompt that enforces:
- Output as JSON with defined schema (sub-tasks array)
- Each sub-task must specify: name, category, system_prompt_tokens, input_context_tokens, output_tokens, interaction_rounds, worst_case_multiplier, reasoning
- The "reasoning" field explains why these token counts were chosen (auditable)

### Constraints
- Users **cannot modify** the calculated token count (per spec requirement)
- Users **can see** the full decomposition and reasoning (transparency)
- The decomposition is stored and can be re-run if the feature description changes

### Volume & Discount Pricing

Discount types factored into cost calculation:
- **Batch API pricing**: 50% discount for async/non-realtime processing
- **Cached input pricing**: reduced rate for repeated context windows
- **Volume tiers**: step-function discounts at monthly spend thresholds
- **Free tiers**: deducted from total before cost calculation

The system actively suggests applicable discounts per feature based on usage patterns (e.g., sub-tasks that don't need real-time responses can use batch pricing).

---

## 6. Budget Optimization

When `budget < total_cost`:
1. Features ranked by user-assigned priority (or LLM-suggested if not set)
2. Knapsack algorithm maximizes total priority-weighted feature coverage within budget
3. Output:
   - Features included (within budget)
   - Features excluded (with individual costs)
   - Cost gap to cover all features
   - Suggested cost reductions (cheaper models, batch pricing, scope reduction)

**Key principle (from CLAUDE.md)**: Never sacrifice quality to fit budget. If a feature is included, it uses the best-fit model -- don't downgrade a code generation task to a cheap model just to fit more features in.

---

## 7. Data Refresh & Model Lifecycle

### Data Sources

**Seed database** (ships with app):
- Curated models, pricing, benchmarks for major providers
- Updated with app releases

**Live overlay**:
- Pricing: OpenRouter API, LiteLLM pricing data, provider pages
- Benchmarks: LMSYS Chatbot Arena, Open LLM Leaderboard, Artificial Analysis
- Model availability: provider API health checks

### Refresh Strategy (app-managed, no external cron)
- **On-demand**: user clicks refresh in UI (per-model, per-category, or full)
- **Scheduled**: APScheduler running inside the FastAPI process, configurable via admin UI
- **Staleness indicators**: "last updated X ago" on all pricing data in UI

### Model Deprecation
- Model disappears from live sources -> marked `deprecated` (not deleted)
- Existing analyses show warning badge: "Model deprecated since [date]"
- New analyses cannot select deprecated models
- System suggests replacement based on closest capability profile

---

## 8. ETA Estimation (Project Timeline)

The system estimates a full project timeline factoring in AI-assisted development speed, human review, and feature dependencies.

### Timeline Calculation

For each feature, the LLM estimates:
- **AI development time**: wall-clock time for AI to generate/process all sub-tasks (based on token count, model throughput, and rate limits)
- **Human review time**: estimated time for a developer to review, test, and integrate AI output (varies by task category)
- **Iteration cycles**: time for back-and-forth refinement (debug, rework, re-prompt)
- **Dependencies**: features that must complete before others can start (critical path)

### Per-Feature Time Formula

```
ai_processing_time(f)  = total_tokens(f) / model_throughput(m)  // tokens per second
human_review_time(f)   = base_review_hours(category) x complexity_factor
iteration_time(f)      = (ai_processing_time(f) + human_review_time(f)) x (interaction_rounds - 1)

feature_duration(f) = ai_processing_time(f) + human_review_time(f) + iteration_time(f)
```

### Project Timeline

1. Build a dependency graph of features (LLM identifies dependencies during decomposition)
2. Apply critical path analysis to determine the minimum project duration
3. Add buffer for integration, testing, and unforeseen issues (configurable, default 20%)
4. Present a Gantt-style timeline with:
   - Per-feature duration bars
   - Dependency arrows
   - Critical path highlighted
   - Total project duration with and without AI assistance (to show AI ROI)

### AI ROI Comparison
For each feature, also estimate the "without AI" duration to demonstrate the value of AI-assisted development. This helps justify the AI cost against developer time savings.

---

## 9. Comparison Mode

- Multiple scenarios per project, each with different:
  - Budget constraints
  - Bundle tier selections
  - Forced model assignments
  - Feature scope (include/exclude features)
- Side-by-side comparison view:
  - Cost delta per feature and total
  - Model differences highlighted
  - Capability trade-offs between scenarios
  - Budget utilization percentage

---

## 10. Frontend Structure

```
src/
  pages/
    Dashboard        -- project list, recent analyses
    NewProject       -- start chat or upload spec
    Chat             -- interview interface with streaming
    Analysis         -- cost table, bundles, feature list
    Comparison       -- side-by-side scenario comparison
    ModelCatalog     -- browse models, benchmarks, pricing
    Settings         -- LLM backend config, refresh schedule
    UserManagement   -- admin: invite users, assign roles
    Login            -- JWT auth login page
    Timeline         -- Gantt-style ETA view
  components/
    CostTable        -- per-feature cost breakdown
    BundleCard       -- Economy/Balanced/Premium summary
    FeatureEditor    -- edit features, priorities, model overrides
    BudgetWarning    -- budget exceeded alert with suggestions
    ChatMessage      -- streaming chat bubble
    ModelSelector    -- model picker with capability scores
    SnapshotTimeline -- historical snapshot browser
    ExportMenu       -- PDF/CSV/JSON export controls
    GanttChart       -- project timeline visualization
    ShareLink        -- generate shareable read-only links
```

---

## 11. Authentication & Access Control

### Auth Model
- Basic role-based access for the internal team
- **Roles**:
  - **Admin**: full access -- manage models, refresh data, configure settings, manage users
  - **Analyst**: create/edit projects, run analyses, create scenarios, export reports
  - **Viewer**: read-only access to projects and analyses (for stakeholders)

### Implementation
- JWT-based authentication with refresh tokens
- Simple user management in the admin settings (invite by email, assign role)
- Session management with configurable expiry
- No external SSO required (internal tool), but the adapter pattern allows adding it later

---

## 12. Export & Reporting

### Export Formats
- **PDF**: Full analysis report with cost tables, bundle comparisons, timeline, and budget warnings. Formatted for presentation to management/stakeholders.
- **CSV**: Raw data export of features, token estimates, costs, and model assignments. For spreadsheet analysis.
- **JSON**: Machine-readable export of the full analysis for integration with other tools.

### Report Contents
- Project summary and feature list
- Token decomposition per feature (with sub-task detail)
- Cost breakdown per feature, per model, per bundle
- Budget analysis (utilization, excluded features, cost gap)
- ETA timeline with dependency graph
- Model recommendations with capability justifications
- Snapshot metadata (pricing as of date X)

### Sharing
- Generate a shareable read-only link (viewer access, time-limited)
- Useful for sharing with stakeholders who don't have accounts

---

## 13. Non-Functional Requirements

- **Performance**: Analysis should complete within 30s for a 20-feature project
- **Data freshness**: Staleness warnings after 7 days without refresh
- **Error handling**: Graceful fallback to seed data when live APIs fail
- **Configuration**: All LLM backend settings configurable without code changes
