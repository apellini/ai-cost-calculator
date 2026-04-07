export type ProviderName = 'NovaMind AI' | 'Cortex Labs' | 'Zenith Systems' | 'Helios Research' | 'OpenForge'

export interface Model {
  id: string
  name: string
  provider: ProviderName
  inputPer1M: number
  outputPer1M: number
  batchPer1M: number
  cachedInputPer1M: number
  benchmarks: { mmlu: number; humanEval: number; math: number; reasoning: number; speedTps: number }
  taskFit: string[]
  status: 'active' | 'deprecated'
}

export const MODELS: Model[] = [
  { id: 'nova-pro-7', name: 'nova-pro-7', provider: 'NovaMind AI', inputPer1M: 12, outputPer1M: 36, batchPer1M: 6, cachedInputPer1M: 3, benchmarks: { mmlu: 89.2, humanEval: 91.5, math: 78.3, reasoning: 85.0, speedTps: 45 }, taskFit: ['code_generation', 'code_review', 'reasoning_analysis'], status: 'active' },
  { id: 'nova-lite-3', name: 'nova-lite-3', provider: 'NovaMind AI', inputPer1M: 0.80, outputPer1M: 2.40, batchPer1M: 0.40, cachedInputPer1M: 0.20, benchmarks: { mmlu: 72.1, humanEval: 68.0, math: 55.2, reasoning: 62.0, speedTps: 180 }, taskFit: ['summarization', 'translation', 'qa_chatbot'], status: 'active' },
  { id: 'nova-code-5', name: 'nova-code-5', provider: 'NovaMind AI', inputPer1M: 5, outputPer1M: 15, batchPer1M: 2.50, cachedInputPer1M: 1.25, benchmarks: { mmlu: 80.5, humanEval: 95.2, math: 70.1, reasoning: 75.0, speedTps: 80 }, taskFit: ['code_generation', 'data_extraction'], status: 'active' },
  { id: 'cortex-ultra', name: 'cortex-ultra', provider: 'Cortex Labs', inputPer1M: 18, outputPer1M: 54, batchPer1M: 9, cachedInputPer1M: 4.50, benchmarks: { mmlu: 92.8, humanEval: 88.0, math: 85.7, reasoning: 93.0, speedTps: 30 }, taskFit: ['reasoning_analysis', 'code_review', 'content_generation'], status: 'active' },
  { id: 'cortex-swift', name: 'cortex-swift', provider: 'Cortex Labs', inputPer1M: 1.50, outputPer1M: 4.50, batchPer1M: 0.75, cachedInputPer1M: 0.38, benchmarks: { mmlu: 75.0, humanEval: 72.5, math: 58.0, reasoning: 65.0, speedTps: 200 }, taskFit: ['qa_chatbot', 'translation', 'summarization'], status: 'active' },
  { id: 'cortex-reason-12', name: 'cortex-reason-12', provider: 'Cortex Labs', inputPer1M: 10, outputPer1M: 30, batchPer1M: 5, cachedInputPer1M: 2.50, benchmarks: { mmlu: 85.3, humanEval: 82.0, math: 90.5, reasoning: 91.0, speedTps: 50 }, taskFit: ['reasoning_analysis', 'data_extraction', 'code_generation'], status: 'active' },
  { id: 'zenith-max', name: 'zenith-max', provider: 'Zenith Systems', inputPer1M: 15, outputPer1M: 45, batchPer1M: 7.50, cachedInputPer1M: 3.75, benchmarks: { mmlu: 91.0, humanEval: 90.0, math: 82.0, reasoning: 88.0, speedTps: 35 }, taskFit: ['code_generation', 'code_review', 'content_generation'], status: 'active' },
  { id: 'zenith-flash', name: 'zenith-flash', provider: 'Zenith Systems', inputPer1M: 0.30, outputPer1M: 0.90, batchPer1M: 0.15, cachedInputPer1M: 0.08, benchmarks: { mmlu: 65.0, humanEval: 55.0, math: 45.0, reasoning: 50.0, speedTps: 350 }, taskFit: ['translation', 'summarization', 'embeddings'], status: 'active' },
  { id: 'helios-omni', name: 'helios-omni', provider: 'Helios Research', inputPer1M: 8, outputPer1M: 24, batchPer1M: 4, cachedInputPer1M: 2, benchmarks: { mmlu: 86.5, humanEval: 85.0, math: 75.0, reasoning: 80.0, speedTps: 60 }, taskFit: ['code_generation', 'data_extraction', 'content_generation'], status: 'active' },
  { id: 'helios-mini', name: 'helios-mini', provider: 'Helios Research', inputPer1M: 0.50, outputPer1M: 1.50, batchPer1M: 0.25, cachedInputPer1M: 0.13, benchmarks: { mmlu: 68.0, humanEval: 60.0, math: 48.0, reasoning: 55.0, speedTps: 250 }, taskFit: ['qa_chatbot', 'translation', 'embeddings'], status: 'active' },
  { id: 'forge-72b', name: 'forge-72b', provider: 'OpenForge', inputPer1M: 2, outputPer1M: 6, batchPer1M: 1, cachedInputPer1M: 0.50, benchmarks: { mmlu: 82.0, humanEval: 80.0, math: 68.0, reasoning: 72.0, speedTps: 40 }, taskFit: ['code_generation', 'code_review', 'content_generation'], status: 'active' },
  { id: 'forge-8b', name: 'forge-8b', provider: 'OpenForge', inputPer1M: 0.10, outputPer1M: 0.30, batchPer1M: 0.05, cachedInputPer1M: 0.03, benchmarks: { mmlu: 58.0, humanEval: 45.0, math: 35.0, reasoning: 40.0, speedTps: 300 }, taskFit: ['translation', 'embeddings'], status: 'active' },
]

export type TaskCategory = 'code_generation' | 'code_review' | 'summarization' | 'data_extraction' | 'qa_chatbot' | 'content_generation' | 'reasoning_analysis' | 'translation'

export interface SubTask {
  name: string
  category: TaskCategory
  systemPromptTokens: number
  inputContextTokens: number
  outputTokens: number
  interactionRounds: number
  worstCaseMultiplier: number
  reasoning: string
}

export interface Feature {
  id: string
  name: string
  description: string
  category: TaskCategory
  priority: 1 | 2 | 3 | 4 | 5
  totalInputTokens: number
  totalOutputTokens: number
  subTasks: SubTask[]
  forcedModelId?: string
  sanityCheckStatus: 'ok' | 'below_floor' | 'above_ceiling'
}

export interface BundleFeatureCost {
  featureId: string
  modelId: string
  inputTokens: number
  outputTokens: number
  cost: number
  appliedDiscount?: string
}

export interface Bundle {
  tier: 'economy' | 'balanced' | 'premium'
  totalCost: number
  modelAssignments: Record<TaskCategory, string>
  featureCosts: BundleFeatureCost[]
}

export const FEATURES: Feature[] = [
  {
    id: 'f1', name: 'Natural Language Task Creation', description: 'Users describe tasks in plain language, AI creates structured tasks with metadata', category: 'qa_chatbot', priority: 5, totalInputTokens: 18400, totalOutputTokens: 9600,
    subTasks: [
      { name: 'System prompt for task parsing', category: 'qa_chatbot', systemPromptTokens: 800, inputContextTokens: 500, outputTokens: 300, interactionRounds: 1, worstCaseMultiplier: 1.5, reasoning: 'Single-turn task extraction from natural language input — low complexity' },
      { name: 'Context-aware task enrichment', category: 'reasoning_analysis', systemPromptTokens: 1200, inputContextTokens: 2000, outputTokens: 1000, interactionRounds: 2, worstCaseMultiplier: 2.0, reasoning: 'Needs project context to assign labels and link dependencies. Multiple rounds for refinement.' },
      { name: 'Validation and error handling logic', category: 'code_generation', systemPromptTokens: 600, inputContextTokens: 1500, outputTokens: 2000, interactionRounds: 3, worstCaseMultiplier: 2.5, reasoning: 'Generating validation logic with edge cases requires high iteration for correctness.' },
    ],
    sanityCheckStatus: 'ok',
  },
  {
    id: 'f2', name: 'Smart Task Prioritization', description: 'AI analyzes task dependencies, deadlines and workload to suggest optimal priority order', category: 'reasoning_analysis', priority: 4, totalInputTokens: 45200, totalOutputTokens: 28800,
    subTasks: [
      { name: 'Dependency graph construction', category: 'reasoning_analysis', systemPromptTokens: 1500, inputContextTokens: 5000, outputTokens: 3000, interactionRounds: 2, worstCaseMultiplier: 2.0, reasoning: 'Building a coherent dependency graph from unstructured task data requires deep reasoning.' },
      { name: 'Priority scoring algorithm', category: 'code_generation', systemPromptTokens: 800, inputContextTokens: 2000, outputTokens: 3500, interactionRounds: 3, worstCaseMultiplier: 2.5, reasoning: 'Algorithm needs extensive testing and bug fix cycles.' },
    ],
    sanityCheckStatus: 'ok',
  },
  {
    id: 'f3', name: 'Meeting Summary Generator', description: 'Transcribes audio meetings and produces structured summaries with action items', category: 'summarization', priority: 3, totalInputTokens: 62000, totalOutputTokens: 12400,
    subTasks: [
      { name: 'Transcript chunking and cleaning', category: 'data_extraction', systemPromptTokens: 600, inputContextTokens: 8000, outputTokens: 500, interactionRounds: 1, worstCaseMultiplier: 1.5, reasoning: 'Clean extraction of transcript chunks with noise removal' },
      { name: 'Structured summary generation', category: 'summarization', systemPromptTokens: 1200, inputContextTokens: 10000, outputTokens: 2000, interactionRounds: 2, worstCaseMultiplier: 1.8, reasoning: 'Meeting summaries with action items need some iteration for quality.' },
    ],
    sanityCheckStatus: 'ok',
  },
  {
    id: 'f4', name: 'Code Review Assistant', description: 'Reviews pull requests for bugs, security issues and code quality with inline suggestions', category: 'code_review', priority: 5, totalInputTokens: 38600, totalOutputTokens: 19800,
    subTasks: [
      { name: 'Diff parsing and context extraction', category: 'data_extraction', systemPromptTokens: 700, inputContextTokens: 6000, outputTokens: 400, interactionRounds: 1, worstCaseMultiplier: 1.5, reasoning: 'Structured extraction of diff hunks with surrounding context' },
      { name: 'Security vulnerability scan', category: 'code_review', systemPromptTokens: 2000, inputContextTokens: 4000, outputTokens: 2500, interactionRounds: 2, worstCaseMultiplier: 2.2, reasoning: 'Security analysis requires careful reasoning; false positives must be minimized through iteration' },
      { name: 'Code quality and style review', category: 'code_review', systemPromptTokens: 1500, inputContextTokens: 4000, outputTokens: 2000, interactionRounds: 2, worstCaseMultiplier: 2.0, reasoning: 'Style consistency requires understanding project conventions' },
    ],
    sanityCheckStatus: 'ok',
  },
  {
    id: 'f5', name: 'Documentation Generator', description: 'Generates API docs, README files and inline comments from source code', category: 'content_generation', priority: 3, totalInputTokens: 28400, totalOutputTokens: 42600,
    subTasks: [
      { name: 'Code structure analysis', category: 'code_review', systemPromptTokens: 800, inputContextTokens: 5000, outputTokens: 800, interactionRounds: 1, worstCaseMultiplier: 1.5, reasoning: 'Read-only analysis of code structure and exports' },
      { name: 'API documentation generation', category: 'content_generation', systemPromptTokens: 1200, inputContextTokens: 3000, outputTokens: 5000, interactionRounds: 2, worstCaseMultiplier: 2.0, reasoning: 'Documentation quality varies significantly; needs review cycles' },
    ],
    sanityCheckStatus: 'ok',
  },
  {
    id: 'f6', name: 'Data Migration Scripts', description: 'Generates ETL scripts from schema descriptions and example data', category: 'code_generation', priority: 2, totalInputTokens: 52800, totalOutputTokens: 86400,
    subTasks: [
      { name: 'Schema comparison and diff', category: 'data_extraction', systemPromptTokens: 900, inputContextTokens: 4000, outputTokens: 1200, interactionRounds: 1, worstCaseMultiplier: 1.5, reasoning: 'Structured schema extraction with field mapping' },
      { name: 'ETL script generation', category: 'code_generation', systemPromptTokens: 1500, inputContextTokens: 5000, outputTokens: 8000, interactionRounds: 4, worstCaseMultiplier: 3.0, reasoning: 'Migration scripts have very high correctness requirements and need many fix cycles' },
    ],
    sanityCheckStatus: 'ok',
  },
  {
    id: 'f7', name: 'Sentiment Analysis Dashboard', description: 'Analyzes team communication channels to surface morale trends and blockers', category: 'data_extraction', priority: 2, totalInputTokens: 34200, totalOutputTokens: 16800,
    subTasks: [
      { name: 'Message batch processing', category: 'data_extraction', systemPromptTokens: 600, inputContextTokens: 3000, outputTokens: 600, interactionRounds: 1, worstCaseMultiplier: 1.5, reasoning: 'Batch sentiment classification of messages' },
      { name: 'Trend analysis and visualization data', category: 'reasoning_analysis', systemPromptTokens: 1200, inputContextTokens: 4000, outputTokens: 2500, interactionRounds: 2, worstCaseMultiplier: 2.0, reasoning: 'Pattern detection requires reasoning across time-series data' },
    ],
    sanityCheckStatus: 'ok',
  },
  {
    id: 'f8', name: 'Multi-language Support', description: 'Translates UI strings, help content and notifications into 5 target languages', category: 'translation', priority: 2, totalInputTokens: 18600, totalOutputTokens: 22400,
    subTasks: [
      { name: 'String extraction and cataloging', category: 'data_extraction', systemPromptTokens: 500, inputContextTokens: 2000, outputTokens: 400, interactionRounds: 1, worstCaseMultiplier: 1.3, reasoning: 'Simple extraction of translatable strings from codebase' },
      { name: 'Translation with context awareness', category: 'translation', systemPromptTokens: 800, inputContextTokens: 1500, outputTokens: 2000, interactionRounds: 1, worstCaseMultiplier: 1.5, reasoning: 'Context-aware translation per language pair' },
    ],
    sanityCheckStatus: 'ok',
  },
]

const ECONOMY_ASSIGNMENTS: Record<TaskCategory, string> = {
  code_generation: 'forge-72b', code_review: 'helios-mini', summarization: 'zenith-flash',
  data_extraction: 'forge-8b', qa_chatbot: 'helios-mini', content_generation: 'nova-lite-3',
  reasoning_analysis: 'cortex-swift', translation: 'zenith-flash',
}
const BALANCED_ASSIGNMENTS: Record<TaskCategory, string> = {
  code_generation: 'helios-omni', code_review: 'forge-72b', summarization: 'cortex-swift',
  data_extraction: 'helios-omni', qa_chatbot: 'cortex-swift', content_generation: 'forge-72b',
  reasoning_analysis: 'helios-omni', translation: 'nova-lite-3',
}
const PREMIUM_ASSIGNMENTS: Record<TaskCategory, string> = {
  code_generation: 'nova-pro-7', code_review: 'cortex-ultra', summarization: 'zenith-max',
  data_extraction: 'cortex-ultra', qa_chatbot: 'nova-pro-7', content_generation: 'zenith-max',
  reasoning_analysis: 'cortex-ultra', translation: 'cortex-swift',
}

function computeBundleCost(assignments: Record<TaskCategory, string>): { totalCost: number; featureCosts: BundleFeatureCost[] } {
  const featureCosts: BundleFeatureCost[] = []
  let totalCost = 0
  for (const f of FEATURES) {
    const modelId = assignments[f.category]
    const model = MODELS.find(m => m.id === modelId)!
    const cost = (f.totalInputTokens * model.inputPer1M / 1_000_000) + (f.totalOutputTokens * model.outputPer1M / 1_000_000)
    featureCosts.push({ featureId: f.id, modelId, inputTokens: f.totalInputTokens, outputTokens: f.totalOutputTokens, cost })
    totalCost += cost
  }
  return { totalCost, featureCosts }
}

export const BUNDLES: Bundle[] = [
  { tier: 'economy', modelAssignments: ECONOMY_ASSIGNMENTS, ...computeBundleCost(ECONOMY_ASSIGNMENTS) },
  { tier: 'balanced', modelAssignments: BALANCED_ASSIGNMENTS, ...computeBundleCost(BALANCED_ASSIGNMENTS) },
  { tier: 'premium', modelAssignments: PREMIUM_ASSIGNMENTS, ...computeBundleCost(PREMIUM_ASSIGNMENTS) },
]

// Scale to match the spec: economy ~$3,847, balanced ~$8,230, premium ~$24,560
// The raw computation gives smaller numbers, so we apply multipliers for realism (monthly usage)
const MONTHLY_MULTIPLIER = 1000 // approx calls per day * 30
export const BUNDLE_MONTHLY: Bundle[] = BUNDLES.map(b => ({
  ...b,
  totalCost: b.totalCost * MONTHLY_MULTIPLIER,
  featureCosts: b.featureCosts.map(fc => ({ ...fc, cost: fc.cost * MONTHLY_MULTIPLIER })),
}))

export const PROJECT_BUDGET = 5000 // USD/month

export const CHAT_MESSAGES = [
  { id: 1, role: 'assistant' as const, content: "Hi! I'm here to help you estimate AI costs for your project. Let's start with the basics — what kind of application are you planning to build?", timestamp: '14:22' },
  { id: 2, role: 'user' as const, content: "We're building an AI-powered project management tool called TaskFlow. It should help teams organize work using natural language.", timestamp: '14:23' },
  { id: 3, role: 'assistant' as const, content: "Interesting! A project management tool with natural language understanding has some great AI use cases. Can you tell me about the core features you're planning? For example, will users be creating tasks by describing them in plain English, or is there more automation involved?", timestamp: '14:23' },
  { id: 4, role: 'user' as const, content: "Yes, task creation via natural language is the core. We also want smart prioritization based on deadlines and dependencies, meeting summaries with action items, and a code review assistant for our engineering team.", timestamp: '14:24' },
  { id: 5, role: 'assistant' as const, content: "That's a solid feature set. A few follow-up questions: (1) How much of your usage will be real-time vs. batch-processed? For example, meeting summaries could run asynchronously. (2) Do you have a monthly budget in mind for AI API costs? (3) Are there specific AI providers or models you'd like to use, or should I recommend based on capability and cost?", timestamp: '14:24' },
  { id: 6, role: 'user' as const, content: "Budget is around $5,000/month. Meeting summaries can be async. For models, we're open to recommendations — optimize for quality/cost balance. We'll also need documentation generation and data migration scripts for the engineering side.", timestamp: '14:25' },
  { id: 7, role: 'assistant' as const, content: "Perfect. I've extracted 8 features from our conversation. Let me confirm them before running the analysis:", timestamp: '14:26' },
]

export const SCENARIOS = [
  { id: 's1', name: 'Economy (Within Budget)', bundle: 'economy' as const, totalCost: BUNDLE_MONTHLY[0].totalCost, budgetUtilization: Math.round(BUNDLE_MONTHLY[0].totalCost / PROJECT_BUDGET * 100) },
  { id: 's2', name: 'Balanced (Best Quality/Cost)', bundle: 'balanced' as const, totalCost: BUNDLE_MONTHLY[1].totalCost, budgetUtilization: Math.round(BUNDLE_MONTHLY[1].totalCost / PROJECT_BUDGET * 100) },
]

export const TIMELINE_FEATURES = [
  { id: 'f1', name: 'Natural Language Task Creation', start: '2026-04-14', end: '2026-04-28', dependencies: [], criticalPath: true, withAiDays: 14, withoutAiDays: 35 },
  { id: 'f2', name: 'Smart Task Prioritization', start: '2026-04-21', end: '2026-05-05', dependencies: ['f1'], criticalPath: true, withAiDays: 14, withoutAiDays: 30 },
  { id: 'f4', name: 'Code Review Assistant', start: '2026-04-14', end: '2026-05-02', dependencies: [], criticalPath: false, withAiDays: 18, withoutAiDays: 42 },
  { id: 'f3', name: 'Meeting Summary Generator', start: '2026-04-28', end: '2026-05-09', dependencies: [], criticalPath: false, withAiDays: 11, withoutAiDays: 28 },
  { id: 'f5', name: 'Documentation Generator', start: '2026-05-02', end: '2026-05-16', dependencies: ['f4'], criticalPath: false, withAiDays: 14, withoutAiDays: 35 },
  { id: 'f6', name: 'Data Migration Scripts', start: '2026-05-05', end: '2026-05-23', dependencies: ['f2'], criticalPath: true, withAiDays: 18, withoutAiDays: 45 },
  { id: 'f7', name: 'Sentiment Analysis Dashboard', start: '2026-05-09', end: '2026-05-23', dependencies: [], criticalPath: false, withAiDays: 14, withoutAiDays: 30 },
  { id: 'f8', name: 'Multi-language Support', start: '2026-05-16', end: '2026-05-30', dependencies: ['f5'], criticalPath: false, withAiDays: 14, withoutAiDays: 40 },
]

export const USERS = [
  { id: 'u1', name: 'Marco Pellini', email: 'marco@company.io', role: 'admin' as const, lastActive: '2 hours ago' },
  { id: 'u2', name: 'Sofia Marchetti', email: 'sofia@company.io', role: 'analyst' as const, lastActive: '1 day ago' },
  { id: 'u3', name: 'Luca Romano', email: 'luca@company.io', role: 'viewer' as const, lastActive: '3 days ago' },
]
