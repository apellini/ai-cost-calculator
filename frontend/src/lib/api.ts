const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function getToken(): string | null {
  return localStorage.getItem('aicost_token')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
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
  is_background: boolean
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

export interface FeatureDelta {
  feature_id: number
  feature_name: string
  left_cost: number
  left_model: string
  right_cost: number
  right_model: string
  delta: number
  left_input_tokens: number
  left_output_tokens: number
}

export interface ComparisonOut {
  left_label: string
  right_label: string
  left_total: number
  right_total: number
  delta: number
  delta_pct: number
  feature_deltas: FeatureDelta[]
}

export interface NotificationOut {
  id: number
  project_id: number | null
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export interface UserOut {
  id: number
  email: string
  name: string
  role: string
  is_active: boolean
  last_active_at: string | null
}

export interface SnapshotOut {
  id: number
  scenario_id: number
  label: string | null
  captured_at: string
  model_count: number
  created_at: string
}

export interface StalenessOut {
  last_updated: string | null
  days_since_update: number | null
  is_stale: boolean
  model_count: number
}

export interface RefreshOut {
  models_updated: number
  message: string
}

export interface FeatureTimelineOut {
  feature_id: number
  feature_name: string
  with_ai_days: number
  without_ai_days: number
  start_date: string
  end_date: string
  depends_on: number[]
  critical_path: boolean
}

export interface TimelineOut {
  features: FeatureTimelineOut[]
  total_with_ai_days: number
  total_without_ai_days: number
  start_date: string
  end_date: string
}

export interface ScenarioOut {
  id: number
  name: string
  notes: string | null
  status: string
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

  // Notifications
  notifications: {
    list: () => request<NotificationOut[]>('/api/notifications'),
    unreadCount: () => request<{ count: number }>('/api/notifications/unread-count'),
    markRead: (id: number) => request<NotificationOut>(`/api/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () => request<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),
  },

  // Exports & sharing
  exports: {
    download: async (projectId: number, format: 'json' | 'csv' | 'pdf', filename: string) => {
      const token = getToken()
      const res = await fetch(`${BASE}/api/projects/${projectId}/export/${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    share: (projectId: number) =>
      request<{ token: string; url: string; label: string | null; created_at: string }>(
        `/api/projects/${projectId}/share`,
        { method: 'POST' }
      ),
  },

  // Users (admin)
  users: {
    list: () => request<UserOut[]>('/api/users'),
  },

  // Snapshots & pricing staleness
  snapshots: {
    list: (projectId: number) => request<SnapshotOut[]>(`/api/projects/${projectId}/snapshots`),
    staleness: () => request<StalenessOut>('/api/models/staleness'),
    refresh: () => request<RefreshOut>('/api/models/refresh', { method: 'POST' }),
  },

  // Timeline
  timeline: {
    get: (projectId: number, startDate?: string) =>
      request<TimelineOut>(
        `/api/projects/${projectId}/timeline${startDate ? `?start_date=${startDate}` : ''}`
      ),
  },

  // Scenarios & comparison
  scenarios: {
    list: (projectId: number) => request<ScenarioOut[]>(`/api/projects/${projectId}/scenarios`),
    compare: (projectId: number, leftTier: string, rightTier: string) =>
      request<ComparisonOut>(
        `/api/projects/${projectId}/compare?left_tier=${leftTier}&right_tier=${rightTier}`
      ),
  },
}
