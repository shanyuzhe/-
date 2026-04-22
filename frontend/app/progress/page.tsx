import Link from "next/link"
import { ArrowLeft, Lightbulb, Target, TrendingUp } from "lucide-react"
import { api } from "@/lib/api"
import { Separator } from "@/components/ui/separator"
import AssessmentPanel from "@/components/AssessmentPanel"
import type { WeeklyPoint, MilestonePrediction } from "@/lib/types"

// 已知 module 翻译;未知的保持原文(支持 408/日语/编程等学科自定义)
const MODULE_LABEL: Record<string, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
}

function translateModule(m: string): string {
  return MODULE_LABEL[m] ?? m
}

function Bar({
  pct,
  tone = "primary",
}: {
  pct: number
  tone?: "primary" | "foreground"
}) {
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

function Sparkline({ points }: { points: WeeklyPoint[] }) {
  const W = 260
  const H = 56
  const PAD_X = 4
  const PAD_Y = 6
  if (points.length === 0) return null

  const step =
    points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : 0
  const yOf = (v01: number) =>
    PAD_Y + (1 - Math.max(0, Math.min(1, v01))) * (H - PAD_Y * 2)

  // rate 已是 0-1;feeling 0-5 归一化为 0-1
  const rateCoords = points.map((p, i) => ({
    x: PAD_X + step * i,
    y: yOf(p.rate),
  }))
  const feelCoords = points.map((p, i) => ({
    x: PAD_X + step * i,
    y: yOf(p.avg_feeling / 5),
  }))

  const ratePoly = rateCoords
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ")
  const feelPoly = feelCoords
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ")

  const rateLast = rateCoords[rateCoords.length - 1]
  const feelLast = feelCoords[feelCoords.length - 1]
  const midY = PAD_Y + 0.5 * (H - PAD_Y * 2)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-14"
      preserveAspectRatio="none"
    >
      {/* 50% 参考线(对 rate 是 50%,对 feeling 是 2.5/5)*/}
      <line
        x1={PAD_X}
        y1={midY}
        x2={W - PAD_X}
        y2={midY}
        stroke="currentColor"
        strokeWidth={0.5}
        strokeDasharray="2 3"
        className="text-muted-foreground/40"
      />
      {/* feeling:淡色,在下层 */}
      <polyline
        points={feelPoly}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-foreground/40"
      />
      {feelCoords.map((c, i) => (
        <circle
          key={`f${i}`}
          cx={c.x}
          cy={c.y}
          r={1.4}
          className="fill-foreground/40"
        />
      ))}
      <circle
        cx={feelLast.x}
        cy={feelLast.y}
        r={2.5}
        className="fill-foreground/70"
      />
      {/* rate:主色,在上层 */}
      <polyline
        points={ratePoly}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-primary"
      />
      {rateCoords.map((c, i) => (
        <circle
          key={`r${i}`}
          cx={c.x}
          cy={c.y}
          r={1.8}
          className="fill-primary/60"
        />
      ))}
      <circle
        cx={rateLast.x}
        cy={rateLast.y}
        r={3}
        className="fill-primary"
      />
    </svg>
  )
}

function describeMilestone(mp: MilestonePrediction): {
  label: string
  tone: "on_track" | "off_track" | "neutral" | "done"
} {
  if (mp.on_track === true && mp.completion_forecast) {
    return { label: `节奏吻合 · 预计 ${mp.completion_forecast}`, tone: "on_track" }
  }
  if (mp.on_track === false && mp.completion_forecast) {
    return { label: `节奏偏慢 · 预计 ${mp.completion_forecast}`, tone: "off_track" }
  }
  if (mp.on_track === true && !mp.completion_forecast) {
    return { label: "已完成目标任务数", tone: "done" }
  }
  // on_track=null 但有 forecast:刚开始数据太少,仅给参考(不判优劣)
  if (mp.on_track === null && mp.completion_forecast) {
    return {
      label: `初期参考 · 按当前节奏 ${mp.completion_forecast}`,
      tone: "neutral",
    }
  }
  if (mp.done_tasks === 0 && mp.target_tasks > 0) {
    return { label: `待启动 · 目标 ${mp.target_tasks} 张`, tone: "neutral" }
  }
  return {
    label: `${mp.done_tasks}/${mp.target_tasks} · 数据不足`,
    tone: "neutral",
  }
}

export default async function ProgressPage() {
  let p
  let full
  try {
    ;[p, full] = await Promise.all([api.progress(), api.progressFull()])
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

  // 把 dict 转成稳定顺序的 entries
  // 只保留本周真的有完成时长的 module(占比 > 0),过滤掉一片 0% 的噪声
  const moduleEntries = Object.entries(p.module_distribution).filter(
    ([, pct]) => pct > 0
  )

  const hasOverall = full.total_tasks > 0 && full.since_date
  // 找"当前进行中"的第一个 phase(on_track 非 undefined 且 done_tasks>0 或 confidence 存在)
  const activeMilestone =
    full.milestone_predictions.find(
      (m) => m.confidence !== null || (m.done_tasks > 0 && m.on_track !== null)
    ) ?? full.milestone_predictions.find((m) => m.done_tasks > 0)

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

      <h1 className="font-serif text-5xl font-medium tracking-tight mb-8">
        进度
      </h1>

      <div className="mb-10 rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex gap-3 items-start">
          <Lightbulb
            className="w-5 h-5 text-primary shrink-0 mt-0.5"
            strokeWidth={1.75}
          />
          <div className="space-y-1.5">
            <p className="font-serif text-base font-medium text-foreground">
              数据源说明
            </p>
            <p className="text-sm text-foreground/75 leading-relaxed">
              完成率、感受、每周轨迹、模块热度
              <strong className="text-foreground">全部基于你的任务反馈自动聚合</strong>。下方
              AI 评语是 V3 读最近任务给的一段建议,<strong className="text-foreground">生成后一直保留</strong>;觉得过时了点"重新生成"让
              V3 再看一次(约 30 秒)。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {/* 总体状态(v0.2 S3)*/}
        {hasOverall && (
          <section className="rounded-xl border border-border/60 bg-card/40 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp
                className="w-4 h-4 text-primary"
                strokeWidth={1.75}
              />
              <p className="text-sm text-muted-foreground">总体状态</p>
              <span className="text-xs text-muted-foreground/70 ml-auto tabular-nums">
                自 {full.since_date}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">覆盖</p>
                <p className="font-serif text-3xl font-medium tabular-nums">
                  {full.days_covered}
                  <span className="text-sm text-muted-foreground font-normal ml-1">
                    天
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">完成</p>
                <p className="font-serif text-3xl font-medium tabular-nums">
                  {Math.round(full.overall_completion_rate * 100)}
                  <span className="text-sm text-muted-foreground font-normal ml-0.5">
                    %
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">平均感受</p>
                <p className="font-serif text-3xl font-medium tabular-nums">
                  {full.overall_avg_feeling.toFixed(1)}
                  <span className="text-sm text-muted-foreground font-normal ml-0.5">
                    /5
                  </span>
                </p>
              </div>
            </div>

            {full.weekly_trajectory.length >= 2 && (
              <div className="mb-5">
                <div className="flex justify-between items-baseline mb-2">
                  <p className="text-xs text-muted-foreground">每周轨迹</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-2.5 h-0.5 bg-primary" />
                      完成率
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-2.5 h-0.5 bg-foreground/40" />
                      感受 /5
                    </span>
                    <span className="tabular-nums">
                      {full.weekly_trajectory.length} 周
                    </span>
                  </div>
                </div>
                <Sparkline points={full.weekly_trajectory} />
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground tabular-nums">
                  <span>{full.weekly_trajectory[0].week_start}</span>
                  <span>
                    {
                      full.weekly_trajectory[
                        full.weekly_trajectory.length - 1
                      ].week_start
                    }
                  </span>
                </div>
              </div>
            )}

            {activeMilestone && (
              <div className="flex items-center gap-2 text-sm border-t border-border/50 pt-4">
                <Target
                  className="w-4 h-4 text-primary shrink-0"
                  strokeWidth={1.75}
                />
                <span className="font-medium">
                  {activeMilestone.phase_name}
                </span>
                <span
                  className={
                    {
                      on_track: "text-primary",
                      off_track: "text-amber-700",
                      done: "text-primary",
                      neutral: "text-muted-foreground",
                    }[describeMilestone(activeMilestone).tone]
                  }
                >
                  {describeMilestone(activeMilestone).label}
                </span>
                {activeMilestone.confidence !== null && (
                  <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                    置信 {Math.round(activeMilestone.confidence * 100)}%
                  </span>
                )}
              </div>
            )}

            <AssessmentPanel
              assessment={full.status_assessment}
              assessmentAt={full.assessment_at}
            />
          </section>
        )}

        {/* 倒计时 */}
        <section>
          <p className="text-sm text-muted-foreground mb-2">距考试</p>
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

        {/* 模块分布(动态 · 根据当前 plan 的 focus_modules)*/}
        <section>
          <div className="flex justify-between items-baseline mb-4">
            <p className="text-sm text-muted-foreground">本周时长分布</p>
            {moduleEntries.length > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                共 {moduleEntries.length} 个模块
              </p>
            )}
          </div>
          {moduleEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              本周还没有完成的任务,完成一些任务后这里会显示各模块时长占比。
            </p>
          ) : (
            <div className="space-y-3">
              {moduleEntries.map(([m, pct]) => (
                <div key={m} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{translateModule(m)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {Math.round(pct * 100)}%
                    </span>
                  </div>
                  <Bar pct={pct} tone="foreground" />
                </div>
              ))}
            </div>
          )}
        </section>

        {p.latest_summary && (
          <>
            <Separator />
            <section>
              <p className="text-sm text-muted-foreground mb-3">
                最新周度观察
              </p>
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
