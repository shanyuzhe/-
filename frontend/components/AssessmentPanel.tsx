"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Loader2, RefreshCcw } from "lucide-react"
import { api } from "@/lib/api"

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const now = Date.now()
  const then = new Date(iso).getTime()
  const mins = Math.max(0, Math.round((now - then) / 60000))
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.round(hours / 24)} 天前`
}

export default function AssessmentPanel({
  assessment,
  assessmentAt,
}: {
  assessment: string | null
  assessmentAt: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState(assessment)
  const [at, setAt] = useState(assessmentAt)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.refreshAssessment()
      setText(res.assessment)
      setAt(res.assessment_at)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  if (!text) {
    return (
      <div className="mt-5 border-t border-border/50 pt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4" strokeWidth={1.75} />
          <span>还没有 AI 评语</span>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
              V3 思考中 约 30 秒
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} />
              生成评语
            </>
          )}
        </button>
        {error && (
          <p className="text-xs text-destructive absolute">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-5 border-t border-border/50 pt-4">
      <div className="flex items-start gap-2 mb-2">
        <Sparkles
          className="w-4 h-4 text-primary mt-0.5 shrink-0"
          strokeWidth={1.75}
        />
        <p className="text-xs text-muted-foreground">AI 评语</p>
        <span className="text-xs text-muted-foreground/70 ml-auto tabular-nums">
          {timeAgo(at)}
        </span>
      </div>
      <blockquote className="font-serif text-[15px] leading-relaxed border-l-2 border-primary pl-4 italic text-foreground/90">
        {text}
      </blockquote>
      <div className="flex justify-end mt-3">
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} />
              V3 重新生成中 约 30 秒
            </>
          ) : (
            <>
              <RefreshCcw className="w-3 h-3" strokeWidth={1.75} />
              重新生成
            </>
          )}
        </button>
      </div>
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </div>
  )
}
