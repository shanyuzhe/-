/**
 * 后端 API 类型(镜像 backend/app/schemas.py)
 * 后端字段变更时同步改这个文件。
 */

export type Module = "listening" | "speaking" | "reading" | "writing"
export type TaskStatus = "pending" | "done" | "skipped" | "swapped"

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

export interface ModuleDistribution {
  listening: number
  speaking: number
  reading: number
  writing: number
}

export interface ProgressResponse {
  days_to_exam: number
  current_phase: string
  phase_progress: number
  weekly_completion_rate: number
  module_distribution: ModuleDistribution
  avg_feeling: number
  latest_summary: string | null
}
