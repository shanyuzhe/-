/**
 * 后端 REST 客户端(对应 backend/app/routers/*)
 */
import type {
  FeedbackRequest,
  FeedbackResponse,
  PlanImportRequest,
  PlanImportResponse,
  PlanOut,
  PlanTemplateResponse,
  ProgressResponse,
  TodayResponse,
} from "./types"

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`API ${path} ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  today: (forceRefresh = false) =>
    request<TodayResponse>(
      `/today${forceRefresh ? "?force_refresh=true" : ""}`
    ),

  feedback: (body: FeedbackRequest) =>
    request<FeedbackResponse>("/feedback", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  progress: () => request<ProgressResponse>("/progress"),

  // --- LearningPlan(v0.1 Plus)---

  planTemplate: () => request<PlanTemplateResponse>("/plan/template"),

  planImport: (body: PlanImportRequest) =>
    request<PlanImportResponse>("/plan/import", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  planActivate: (id: number) =>
    request<PlanOut>(`/plan/${id}/activate`, { method: "POST" }),

  planActive: () => request<PlanOut | null>("/plan/active"),
}
