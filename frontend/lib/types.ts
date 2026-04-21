/**
 * 后端 API 类型(镜像 backend/app/schemas.py)
 * 后端字段变更时同步改这个文件。
 */

// module 不再限定雅思四模块,允许任意学科字符串
// MODULE_LABEL 映射常见中文名,未知 module 直接显示原文
export type Module = string
export type TaskStatus = "pending" | "done" | "skipped" | "swapped"

// ============ Today / Task / Feedback / Progress ============

export interface TaskOut {
  id: number
  date: string // YYYY-MM-DD
  seq: number
  module: Module
  title: string
  description: string
  rationale?: string | null
  estimated_minutes: number
  actual_minutes?: number | null
  status: TaskStatus
  feeling?: number | null
  note?: string | null
}

export interface TodayResponse {
  date: string
  days_to_exam: number
  phase_name: string
  phase_focus: Module[]
  tasks: TaskOut[]
  completion_rate: number
}

export interface FeedbackRequest {
  task_id: number
  status: "done" | "skipped" | "swapped"
  actual_minutes?: number
  feeling?: number
  note?: string
}

export interface FeedbackResponse {
  ok: boolean
  task_id: number
  status: string
  feeling: number | null
}

// 动态 module 占比:key = 当前 plan 的 focus_modules(中文),value = 本周时长占比
export type ModuleDistribution = Record<string, number>

export interface ProgressResponse {
  days_to_exam: number
  current_phase: string
  phase_progress: number
  weekly_completion_rate: number
  module_distribution: ModuleDistribution
  avg_feeling: number
  latest_summary: string | null
}

// ============ /progress/full(v0.2 S2)============

export interface WeeklyPoint {
  week_start: string
  rate: number
  avg_feeling: number
  tasks: number
}

export interface ModuleHeat {
  total_min: number
  done_rate: number
  avg_feeling: number
}

export interface MilestonePrediction {
  phase_name: string
  on_track: boolean | null
  confidence: number | null
  completion_forecast: string | null
  phase_end: string | null
  done_tasks: number
  target_tasks: number
}

export interface ProgressFullResponse {
  since_date: string | null
  plan_activated_at: string | null
  days_covered: number
  overall_completion_rate: number
  overall_avg_feeling: number
  total_tasks: number
  weekly_trajectory: WeeklyPoint[]
  module_heatmap: Record<string, ModuleHeat>
  milestone_predictions: MilestonePrediction[]
  status_assessment: string | null
}

// ============ LearningPlan(v0.1 Plus)============

export interface PhaseData {
  name: string
  start_date: string // YYYY-MM-DD
  end_date: string
  focus_modules: Module[]
  objectives?: string | null
}

export interface Resource {
  name: string
  url?: string | null
  type: string
  why?: string | null
  phase?: string | null
}

export interface DailyHabit {
  habit: string
  tool?: string | null
  amount?: string | null
  timing?: string | null
}

export interface Checkpoint {
  date: string // YYYY-MM-DD
  type: string
  material?: string | null
  target?: string | null
}

export interface ExtractedPlan {
  subject: string
  daily_hours?: number | null
  phases: PhaseData[]
  resources: Resource[]
  daily_habits: DailyHabit[]
  task_principles: string[]
  checkpoints: Checkpoint[]
}

export interface PlanImportRequest {
  raw_text: string
  source_ai?: string
}

export interface PlanImportResponse {
  plan_id: number
  extracted: ExtractedPlan
  warnings: string[]
}

export interface PlanTemplateResponse {
  template: string
}

export interface PlanOut {
  id: number
  subject: string
  status: string
  source_ai?: string | null
  daily_hours?: number | null
  phases_data: PhaseData[]
  resources: Resource[]
  daily_habits: DailyHabit[]
  task_principles: string[]
  checkpoints: Checkpoint[]
  created_at: string
  activated_at?: string | null
}
