import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { api } from "@/lib/api"
import { Separator } from "@/components/ui/separator"
import type { Module } from "@/lib/types"

const MODULE_LABEL: Record<Module, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
}

function Bar({ pct, tone = "primary" }: { pct: number; tone?: "primary" | "foreground" }) {
  const w = Math.max(0, Math.min(1, pct)) * 100
  const toneCls = tone === "primary" ? "bg-primary" : "bg-foreground/40"
  return (
    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full ${toneCls} transition-all duration-500`}
        style={{ width: `${w}%` }}
      />
    </div>
  )
}

export default async function ProgressPage() {
  let p
  try {
    p = await api.progress()
  } catch (e) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-serif text-3xl font-medium">无法连接后端</h1>
        <p className="text-xs text-muted-foreground mt-4">
          {e instanceof Error ? e.message : String(e)}
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          返回今天
        </Link>
      </nav>

      <h1 className="font-serif text-5xl font-medium tracking-tight mb-12">
        进度
      </h1>

      <div className="space-y-10">
        {/* 倒计时 */}
        <section>
          <p className="text-sm text-muted-foreground mb-2">距雅思考试</p>
          <p className="font-serif text-7xl font-medium tabular-nums tracking-tight">
            {p.days_to_exam}
            <span className="text-2xl text-muted-foreground font-normal ml-3">
              天
            </span>
          </p>
        </section>

        <Separator />

        {/* 阶段进度 */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-sm text-muted-foreground">当前阶段</p>
              <h2 className="font-serif text-2xl font-medium mt-1">
                {p.current_phase}
              </h2>
            </div>
            <span className="text-sm text-muted-foreground tabular-nums">
              {Math.round(p.phase_progress * 100)}%
            </span>
          </div>
          <Bar pct={p.phase_progress} />
        </section>

        {/* 本周完成率 */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-sm text-muted-foreground">本周完成率</p>
              <h2 className="font-serif text-2xl font-medium mt-1 tabular-nums">
                {Math.round(p.weekly_completion_rate * 100)}
                <span className="text-base text-muted-foreground">%</span>
              </h2>
            </div>
            <span className="text-sm text-muted-foreground">
              平均感受 {p.avg_feeling.toFixed(1)}/5
            </span>
          </div>
          <Bar pct={p.weekly_completion_rate} />
        </section>

        <Separator />

        {/* 四模块分布 */}
        <section>
          <p className="text-sm text-muted-foreground mb-4">本周时长分布</p>
          <div className="space-y-4">
            {(
              ["listening", "speaking", "reading", "writing"] as const
            ).map((m) => (
              <div key={m} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>{MODULE_LABEL[m]}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {Math.round(p.module_distribution[m] * 100)}%
                  </span>
                </div>
                <Bar pct={p.module_distribution[m]} tone="foreground" />
              </div>
            ))}
          </div>
        </section>

        {p.latest_summary && (
          <>
            <Separator />
            <section>
              <p className="text-sm text-muted-foreground mb-3">最新周度观察</p>
              <blockquote className="font-serif text-lg leading-relaxed border-l-2 border-primary pl-4 italic">
                {p.latest_summary}
              </blockquote>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
