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
Pre-defined categories with baseline estimation parameters:

| Category | Avg Input Tokens | Avg Output Tokens | Iteration Multiplier |
|---|---|---|---|
| code_generation | 2,000 | 4,000 | 3.0x |
| code_review | 3,000 | 1,500 | 1.5x |
| summarization | 5,000 | 1,000 | 1.2x |
| data_extraction | 4,000 | 2,000 | 2.0x |
| qa_chatbot | 1,000 | 500 | 1.0x |
| content_generation | 2,000 | 3,000 | 2.0x |
| reasoning_analysis | 3,000 | 3,000 | 2.5x |
| translation | 2,000 | 2,000 | 1.3x |
| image_generation | 500 | N/A | 1.5x |
| embeddings | 1,000 | N/A | 1.0x |

### Project
- `id`, `name`, `description`, `budget` (optional), `created_at`
- Has many `Feature`, `Scenario`, `Snapshot`

### Feature
- `id`, `project_id`, `name`, `description`
- `task_category_id` (auto-classified, user can override)
- `priority` (1-5, for budget optimization)
- `base_token_estimate`, `llm_complexity_factor` (0.8-3.0), `total_token_estimate`
- `forced_model_id` (optional -- user override)

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
2. Token estimation runs: `base_tokens x iteration_multiplier x llm_complexity_factor`
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
    │       ├── TokenEstimator (formula + LLM refinement)
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

# Admin / Settings
GET    /api/settings/refresh-schedule
PUT    /api/settings/refresh-schedule
```

---

## 5. Token Estimation Engine

### Core Formula

```
For each feature f, task category c, model m:

base_tokens(f)      = category_input_tokens(c) + category_output_tokens(c)
iteration_tokens(f)  = base_tokens(f) x iteration_multiplier(c)
refined_tokens(f)    = iteration_tokens(f) x llm_complexity_factor(f)
total_tokens(f)      = refined_tokens(f)   // always worst-case

input_ratio          = category_input_tokens(c) / base_tokens(f)
output_ratio         = category_output_tokens(c) / base_tokens(f)

cost(f, m) = (total_tokens(f) x input_ratio x price_per_input(m))
           + (total_tokens(f) x output_ratio x price_per_output(m))
```

### LLM Complexity Factor
The local LLM analyzes each feature description and returns a complexity factor (0.8 to 3.0):
- **0.8**: Simpler than average for its category
- **1.0**: Typical complexity
- **1.5-2.0**: Complex (multi-step, large context)
- **2.0-3.0**: Very complex (novel architecture, extensive iteration)

Users cannot modify the calculated token count (per spec requirement).

### Volume & Discount Pricing

Discount types factored into cost calculation:
- **Batch API pricing**: 50% discount for async/non-realtime processing
- **Cached input pricing**: reduced rate for repeated context windows
- **Volume tiers**: step-function discounts at monthly spend thresholds
- **Free tiers**: deducted from total before cost calculation

The system actively suggests applicable discounts per feature based on usage patterns.

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

## 8. Comparison Mode

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

## 9. Frontend Structure

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
  components/
    CostTable        -- per-feature cost breakdown
    BundleCard       -- Economy/Balanced/Premium summary
    FeatureEditor    -- edit features, priorities, model overrides
    BudgetWarning    -- budget exceeded alert with suggestions
    ChatMessage      -- streaming chat bubble
    ModelSelector    -- model picker with capability scores
    SnapshotTimeline -- historical snapshot browser
```

---

## 10. Non-Functional Requirements

- **Performance**: Analysis should complete within 30s for a 20-feature project
- **Data freshness**: Staleness warnings after 7 days without refresh
- **Error handling**: Graceful fallback to seed data when live APIs fail
- **Configuration**: All LLM backend settings configurable without code changes
