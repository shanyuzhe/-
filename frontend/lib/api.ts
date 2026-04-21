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
  ProgressFullResponse,
  ProgressResponse,
  TodayResponse,
} from "./types"

/**
 * API base 智能切换:
 * - Server Component(Node 进程):直连 http://127.0.0.1:8000
 * - Client Component(浏览器):走 Next.js 代理 /api/proxy/*
 *   避免 Windows Clash 系统代理 hook 浏览器 127.0.0.1 请求
 */
const API_BASE =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000"
    : "/api/proxy"

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

  progressFull: () => request<ProgressFullResponse>("/progress/full"),

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
