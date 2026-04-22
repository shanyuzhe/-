"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
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

const EXAMPLES = [
  "今天多做听力,少一点口语",
  "手疼,跳过口语",
  "只复盘昨天的错题,别加新内容",
  "时间不够,今天砍半",
]

export function RefreshTasksButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
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

  async function generate() {
    setLoading(true)
    try {
      await api.today(true, note.trim())
      toast.success(
        note.trim()
          ? `已按你的要求重新生成:"${note.slice(0, 20)}${note.length > 20 ? "…" : ""}"`
          : "今日任务已重新生成"
      )
      setOpen(false)
      setNote("")
      router.refresh()
    } catch (e) {
      toast.error(
        `生成失败:${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* 单一精美 pill 按钮(嵌在 header 里,nav 下方)*/}
      <button
        onClick={() => setOpen(true)}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1.5 px-4 py-2 rounded-full",
          "bg-primary text-primary-foreground text-sm font-medium shadow-sm",
          "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
          "transition-all duration-200",
          "disabled:opacity-60 disabled:cursor-not-allowed"
        )}
        aria-label="重新生成今日任务"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Sparkles className="w-4 h-4" strokeWidth={1.75} />
        )}
        重新生成今日任务
      </button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!loading) setOpen(v)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" strokeWidth={1.75} />
              重新生成今日任务
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              AI 会根据你的规划(每日时长 / 习惯 / 原则 / 资源 / 阶段目标)和
              近 7 天的完成情况重新出一份任务。
            </p>

            <div>
              <label className="block text-sm font-medium mb-2">
                今天有什么临时要求?(可选)
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={loading}
                placeholder="比如:今天多做听力,少一点口语"
                className="text-sm"
              />
              <div className="mt-2 flex gap-1.5 flex-wrap">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setNote(ex)}
                    disabled={loading}
                    className="text-xs px-2 py-1 rounded-md border border-border hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
                {note.length}/500 · 留空就按规划正常出
              </p>
            </div>

            {/* Loading 进度条 */}
            {loading && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Loader2
                    className="w-4 h-4 animate-spin text-primary shrink-0 mt-0.5"
                    strokeWidth={1.75}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {getRefreshStatus(elapsed)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                      已等 {elapsed} 秒 · 典型 30 秒
                    </p>
                  </div>
                </div>
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-[width] duration-500 ease-out"
                    style={{ width: `${Math.min(95, (elapsed / 30) * 95)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button onClick={generate} disabled={loading}>
              {loading ? (
                <>
                  <Loader2
                    className="w-4 h-4 mr-1.5 animate-spin"
                    strokeWidth={1.75}
                  />
                  生成中
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
                  重新生成
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
