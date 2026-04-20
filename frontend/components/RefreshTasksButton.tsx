"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

function getRefreshStatus(sec: number): string {
  if (sec < 3) return "连接 DeepSeek..."
  if (sec < 12) return "读取你的 plan 和近 7 天状态..."
  if (sec < 35) return "V3 正在生成任务卡..."
  if (sec < 60) return "马上好了,整理输出..."
  if (sec < 100) return "比平常慢,再等等"
  return "网络或 API 有点慢,将尝试 fallback"
}

export function RefreshTasksButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (loading) {
      setElapsed(0)
      timerRef.current = setInterval(
        () => setElapsed((n) => n + 1),
        1000
      )
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [loading])

  async function refresh() {
    setLoading(true)
    try {
      await api.today(true)
      toast.success("今日任务已重新生成")
      router.refresh()
    } catch (e) {
      toast.error(
        `刷新失败:${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={refresh}
        disabled={loading}
        aria-label="重新生成今日任务"
      >
        <RefreshCw
          className={cn("w-4 h-4", loading && "animate-spin")}
          strokeWidth={1.75}
        />
      </Button>

      {/* 浮动进度卡(右下角,不遮挡主内容)*/}
      {loading && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-card border border-primary/30 rounded-xl shadow-lg p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-3">
            <Loader2
              className="w-5 h-5 animate-spin text-primary shrink-0 mt-0.5"
              strokeWidth={1.75}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">
                {getRefreshStatus(elapsed)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                已等 {elapsed} 秒 · 典型 30 秒
              </p>
            </div>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(95, (elapsed / 30) * 95)}%` }}
            />
          </div>
        </div>
      )}
    </>
  )
}
