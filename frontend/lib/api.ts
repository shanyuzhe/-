/**
 * 后端 REST 客户端(对应 backend/app/routers/*)
 *
 * Server Component 里直接 await api.today() 即可。
 * Client Component 里也可以用,但要在 'use client' 文件中调。
 */
import type {
  FeedbackRequest,
  FeedbackResponse,
  ProgressResponse,
  TodayResponse,
} from "./types"

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    // v0.1:每次都新鲜数据,不缓存
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
}
