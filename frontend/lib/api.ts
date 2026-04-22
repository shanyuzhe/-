/**
 * 后端 REST 客户端(对应 backend/app/routers/*)
 */
import type {
  DailyHoursPatchRequest,
  FeedbackRequest,
  FeedbackResponse,
  HabitsPatchRequest,
  LoginRequest,
  PhasePatchRequest,
  PlanImportRequest,
  PlanImportResponse,
  PlanOut,
  PlanTemplateResponse,
  PrinciplesPatchRequest,
  ProgressFullResponse,
  ProgressResponse,
  RegisterRequest,
  ResourcesPatchRequest,
  TodayResponse,
  TokenResponse,
  UserInfo,
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

/**
 * 读 token:server 走 next/headers cookies(),client 走 document.cookie。
 * Dynamic import 保证 client bundle 不引入 server-only 模块。
 */
async function getToken(): Promise<string | null> {
  if (typeof window !== "undefined") {
    const { getClientToken } = await import("./auth-client")
    return getClientToken()
  }
  const { getServerToken } = await import("./auth-server")
  return getServerToken()
}

/**
 * 某些端点不需要 auth(register / login),用 skipAuth 跳过 token 读取。
 */
async function request<T>(
  path: string,
  init?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const { skipAuth, ...rest } = init ?? {}
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...((rest.headers as Record<string, string>) ?? {}),
  }
  if (!skipAuth) {
    const token = await getToken()
    if (token) baseHeaders["Authorization"] = `Bearer ${token}`
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    cache: "no-store",
    headers: baseHeaders,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`API ${path} ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  // v0.4 Auth(这两个 skipAuth:注册/登录时没 token)
  register: (body: RegisterRequest) =>
    request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
      skipAuth: true,
    }),

  login: (body: LoginRequest) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
      skipAuth: true,
    }),

  me: () => request<UserInfo>("/auth/me"),

  today: (forceRefresh = false, note = "") => {
    const params = new URLSearchParams()
    if (forceRefresh) params.set("force_refresh", "true")
    if (note) params.set("note", note)
    const qs = params.toString()
    return request<TodayResponse>(`/today${qs ? `?${qs}` : ""}`)
  },

  feedback: (body: FeedbackRequest) =>
    request<FeedbackResponse>("/feedback", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  progress: () => request<ProgressResponse>("/progress"),

  progressFull: () => request<ProgressFullResponse>("/progress/full"),

  refreshAssessment: () =>
    request<{ assessment: string; assessment_at: string | null }>(
      "/progress/assessment/refresh",
      { method: "POST" }
    ),

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

  // v0.3 S1: Plan 在线编辑
  planPatchPhase: (planId: number, index: number, body: PhasePatchRequest) =>
    request<PlanOut>(`/plan/${planId}/phase/${index}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  planPatchHabits: (planId: number, body: HabitsPatchRequest) =>
    request<PlanOut>(`/plan/${planId}/habits`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  planPatchResources: (planId: number, body: ResourcesPatchRequest) =>
    request<PlanOut>(`/plan/${planId}/resources`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  planPatchPrinciples: (planId: number, body: PrinciplesPatchRequest) =>
    request<PlanOut>(`/plan/${planId}/principles`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  planPatchDailyHours: (planId: number, body: DailyHoursPatchRequest) =>
    request<PlanOut>(`/plan/${planId}/daily-hours`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
}
