const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Types (mirrors backend schemas) ─────────────────────────────────────────

export interface Benchmark {
  mmlu: number | null
  human_eval: number | null
  math: number | null
  reasoning: number | null
  speed_tps: number | null
}

export interface Provider {
  id: number
  name: string
  website: string | null
}

export interface Model {
  id: number
  slug: string
  display_name: string
  context_window: number | null
  input_per_1m: number
  output_per_1m: number
  batch_per_1m: number | null
  cached_input_per_1m: number | null
  volume_tiers: { min_tokens: number; discount_pct: number }[] | null
  task_fit: Record<string, number> | null
  is_active: boolean
  updated_at: string
  provider: Provider
  benchmark: Benchmark | null
}

export interface SubTask {
  id: number
  name: string
  category: string
  reasoning: string | null
  system_prompt_tokens: number
  input_context_tokens: number
  output_tokens: number
  interaction_rounds: number
  worst_case_multiplier: number
  order: number
}

export interface Feature {
  id: number
  name: string
  description: string | null
  category: string | null
  priority: number
  order: number
  total_input_tokens: number | null
  total_output_tokens: number | null
  sub_tasks: SubTask[]
  updated_at: string
}

export interface Project {
  id: number
  name: string
  description: string | null
  budget_monthly: number | null
  status: string
  created_at: string
  updated_at: string
  feature_count: number
}

export interface ProjectDetail extends Project {
  features: Feature[]
}

export interface ProjectCreate {
  name: string
  description?: string
  budget_monthly?: number
}

export interface FeatureCreate {
  name: string
  description?: string
  category?: string
  priority?: number
}

export interface FeatureCostOut {
  feature_id: number
  model_id: number
  model_slug: string
  cost: number
  input_tokens: number
  output_tokens: number
}

export interface BundleOut {
  tier: string
  total_cost: number
  feature_costs: FeatureCostOut[]
}

export interface AnalysisOut {
  scenario_id: number
  status: string
  bundles: BundleOut[]
  elapsed_seconds: number | null
  warnings: string[]
}

export interface TaskCategory {
  slug: string
  label: string
  description: string | null
  min_input_tokens: number
  max_input_tokens: number
  min_output_tokens: number
  max_output_tokens: number
}

// ── API calls ────────────────────────────────────────────────────────────────

export const api = {
  // Models
  models: {
    list: (provider?: string) =>
      request<Model[]>(`/api/models${provider ? `?provider=${encodeURIComponent(provider)}` : ''}`),
    providers: () => request<string[]>('/api/models/providers'),
  },

  // Projects
  projects: {
    list: () => request<Project[]>('/api/projects'),
    get: (id: number) => request<ProjectDetail>(`/api/projects/${id}`),
    create: (body: ProjectCreate) =>
      request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: Partial<ProjectCreate>) =>
      request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: number) =>
      request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
  },

  // Features
  features: {
    list: (projectId: number) => request<Feature[]>(`/api/projects/${projectId}/features`),
    add: (projectId: number, body: FeatureCreate) =>
      request<Feature>(`/api/projects/${projectId}/features`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    delete: (projectId: number, featureId: number) =>
      request<void>(`/api/projects/${projectId}/features/${featureId}`, { method: 'DELETE' }),
  },

  // Analysis
  analysis: {
    run: (projectId: number) =>
      request<AnalysisOut>(`/api/projects/${projectId}/analyze`, { method: 'POST' }),
    get: (projectId: number) =>
      request<AnalysisOut>(`/api/projects/${projectId}/analyze`),
  },

  // Task categories
  taskCategories: {
    list: () => request<TaskCategory[]>('/api/task-categories'),
  },
}
