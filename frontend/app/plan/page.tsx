import Link from "next/link"
import { ArrowLeft, RotateCw, Sparkles } from "lucide-react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import PhaseEditor from "@/components/PhaseEditor"
import HabitsEditor from "@/components/HabitsEditor"
import PrinciplesEditor from "@/components/PrinciplesEditor"
import ResourcesEditor from "@/components/ResourcesEditor"
import DailyHoursEditor from "@/components/DailyHoursEditor"
import type { PlanOut } from "@/lib/types"

const SOURCE_LABEL: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  kimi: "Kimi",
  doubao: "豆包",
}

const MODULE_LABEL: Record<string, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
}

function translateModule(m: string): string {
  return MODULE_LABEL[m] ?? m
}

export default async function PlanPage() {
  let plan: PlanOut | null = null
  try {
    plan = await api.planActive()
  } catch {
    plan = null
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          返回今天
        </Link>
      </nav>

      {plan ? <PlanHeader plan={plan} /> : <EmptyHeader />}

      {!plan ? (
        <NoPlan />
      ) : (
        <>
          <PlanOverview plan={plan} />
          <Separator className="my-10" />
          <PlanDetail plan={plan} />
        </>
      )}
    </main>
  )
}

// ============ Header ============

function PlanHeader({ plan }: { plan: PlanOut }) {
  const source = SOURCE_LABEL[plan.source_ai ?? ""] ?? plan.source_ai ?? "AI"
  const activated = plan.activated_at
    ? new Date(plan.activated_at).toLocaleDateString("zh-CN")
    : null

  return (
    <header className="mb-10 flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">
          科目:<span className="font-medium">{plan.subject}</span>
          <span className="mx-2">·</span>
          来自 {source}
          {activated && (
            <>
              <span className="mx-2">·</span>
              激活于 {activated}
            </>
          )}
        </p>
        <h1 className="font-serif text-5xl font-medium tracking-tight mt-2">
          我的规划
        </h1>
      </div>
      <Link href="/onboarding">
        <Button size="lg" variant="outline">
          <RotateCw className="w-4 h-4 mr-2" strokeWidth={1.75} />
          重新导入
        </Button>
      </Link>
    </header>
  )
}

function EmptyHeader() {
  return (
    <header className="mb-10">
      <p className="text-sm text-muted-foreground">尚未导入个性化规划</p>
      <h1 className="font-serif text-5xl font-medium tracking-tight mt-2">
        学习规划
      </h1>
    </header>
  )
}

// ============ No-plan CTA ============

function NoPlan() {
  return (
    <Card className="bg-primary/5 border-primary/30">
      <CardContent className="text-center space-y-5 py-12 px-6">
        <Sparkles
          className="w-12 h-12 text-primary mx-auto"
          strokeWidth={1.5}
        />
        <div className="max-w-md mx-auto space-y-2">
          <h2 className="font-serif text-2xl font-medium">
            还在用默认规划
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            去 Claude / Kimi 聊一份个性化的(10-20 分钟),让每日任务含具体资源:
            UP 主课、App、书、自检节点。
          </p>
        </div>
        <Link href="/onboarding">
          <Button size="lg">从 AI 生成我的规划 →</Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// ============ Plan Detail ============

function PlanDetail({ plan }: { plan: PlanOut }) {
  return (
    <div className="space-y-10">
      <Section title="阶段划分" count={plan.phases_data.length}>
        <PhaseEditor planId={plan.id} phases={plan.phases_data} />
      </Section>

      <Separator />

      <Section title="资源推荐" count={plan.resources.length}>
        <ResourcesEditor planId={plan.id} resources={plan.resources} />
      </Section>

      <Separator />

      <Section title="每日 Habit" count={plan.daily_habits.length}>
        <HabitsEditor planId={plan.id} habits={plan.daily_habits} />
      </Section>

      <Separator />

      <Section title="任务原则" count={plan.task_principles.length}>
        <PrinciplesEditor
          planId={plan.id}
          principles={plan.task_principles}
        />
      </Section>

      <Separator />

      <Section title="自检节点" count={plan.checkpoints.length}>
        <div className="space-y-2">
          {plan.checkpoints.map((c, i) => (
            <Card key={i}>
              <CardContent className="pt-6 flex items-center gap-3 flex-wrap">
                <span className="font-medium tabular-nums">{c.date}</span>
                <Badge
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {c.type}
                </Badge>
                <span className="text-xs text-muted-foreground flex-1 min-w-0">
                  {[c.material, c.target].filter(Boolean).join(" · ")}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ============ Visual Overview(时间线 + 当前阶段)============

function PlanOverview({ plan }: { plan: PlanOut }) {
  // Bug 2 修:过滤掉 start_date / end_date 不是合法 YYYY-MM-DD 的阶段
  // 否则 NaN 宽度会让所有 bar 叠成一堆(408 的"考试前"阶段就是这坑)
  const isValidDate = (s: string) => {
    const d = new Date(`${s}T00:00:00Z`)
    return !isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(s)
  }
  const phases = [...plan.phases_data]
    .filter(
      (p) =>
        p.start_date &&
        p.end_date &&
        isValidDate(p.start_date) &&
        isValidDate(p.end_date)
    )
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  if (phases.length === 0) {
    return (
      <section className="mb-2">
        <p className="text-sm text-muted-foreground">
          规划没有阶段数据,无法展示时间线。
        </p>
      </section>
    )
  }

  // 以 Asia/Shanghai 为基准的"今天"(避免 SSR Node 进程 UTC 偏差)
  const todayStr = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Shanghai",
  })
  const today = new Date(`${todayStr}T00:00:00Z`)

  const planStart = new Date(`${phases[0].start_date}T00:00:00Z`)
  const planEnd = new Date(`${phases[phases.length - 1].end_date}T00:00:00Z`)
  // 包含结束日当天,+1 天
  const totalMs = planEnd.getTime() - planStart.getTime() + 86400000
  const totalDays = Math.round(totalMs / 86400000)

  const todayPct = Math.max(
    0,
    Math.min(
      100,
      ((today.getTime() - planStart.getTime()) / totalMs) * 100
    )
  )

  const currentIdx = phases.findIndex(
    (p) => p.start_date <= todayStr && p.end_date >= todayStr
  )
  const current = currentIdx >= 0 ? phases[currentIdx] : null
  const next =
    currentIdx >= 0 && currentIdx < phases.length - 1
      ? phases[currentIdx + 1]
      : phases.find((p) => p.start_date > todayStr) ?? null

  const daysToExam = Math.max(
    0,
    Math.ceil((planEnd.getTime() - today.getTime()) / 86400000)
  )

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-2xl font-medium">概览</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          距结束 {daysToExam} 天 · 共 {totalDays} 天
        </span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="pt-6 space-y-6">
          {/* 每日学习时长(可编辑核心指标)*/}
          <DailyHoursEditor planId={plan.id} initial={plan.daily_hours} />

          {/* 日期范围 */}
          <div className="flex justify-between items-center text-xs text-muted-foreground tabular-nums">
            <span>{phases[0].start_date}</span>
            <span>今天 {todayStr}</span>
            <span>{phases[phases.length - 1].end_date}</span>
          </div>

          {/* 时间线 */}
          <div className="relative h-14 rounded-md overflow-hidden border border-border/60 bg-muted/30">
            {phases.map((p, i) => {
              const ps = new Date(`${p.start_date}T00:00:00Z`)
              const pe = new Date(`${p.end_date}T00:00:00Z`)
              const left =
                ((ps.getTime() - planStart.getTime()) / totalMs) * 100
              const width =
                ((pe.getTime() - ps.getTime() + 86400000) / totalMs) * 100
              const isCurrent = i === currentIdx
              const isPast = pe.getTime() < today.getTime()
              return (
                <div
                  key={i}
                  className={cn(
                    "absolute top-0 bottom-0 border-r border-background/70 flex items-center justify-center text-xs font-medium px-2 transition-all",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isPast
                      ? "bg-muted-foreground/30 text-muted-foreground"
                      : "bg-muted-foreground/15 text-foreground/70"
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${p.name} ${p.start_date} → ${p.end_date}`}
                >
                  <span className="truncate">{p.name}</span>
                </div>
              )
            })}
            {/* 今天标记线 */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10 pointer-events-none"
              style={{ left: `${todayPct}%` }}
            >
              <div className="absolute -top-1 left-0 -translate-x-1/2 -translate-y-full text-[10px] text-destructive font-medium whitespace-nowrap tabular-nums bg-background px-1 rounded-sm border border-destructive/30">
                今天
              </div>
            </div>
          </div>

          {/* 当前阶段详情 */}
          {current ? (
            <div className="space-y-2 pt-2">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  当前阶段
                </span>
                <span className="font-serif text-xl font-medium">
                  {current.name}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {current.start_date} → {current.end_date}
                </span>
              </div>
              {current.focus_modules.length > 0 && (
                <div className="flex gap-1.5 flex-wrap items-center">
                  <span className="text-xs text-muted-foreground">重点:</span>
                  {current.focus_modules.map((m) => (
                    <Badge key={m} variant="secondary" className="font-normal">
                      {translateModule(m)}
                    </Badge>
                  ))}
                </div>
              )}
              {current.objectives && (
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {current.objectives}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground pt-2">
              今天({todayStr})不在任何阶段内。
            </p>
          )}

          {/* 下一阶段预告 */}
          {next && next !== current && (
            <div className="border-t border-border/60 pt-3">
              <div className="flex items-baseline gap-2 flex-wrap text-xs">
                <span className="uppercase tracking-wider text-muted-foreground">
                  下一阶段
                </span>
                <span className="font-medium">{next.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {Math.max(
                    0,
                    Math.ceil(
                      (new Date(`${next.start_date}T00:00:00Z`).getTime() -
                        today.getTime()) /
                        86400000
                    )
                  )}{" "}
                  天后 · {next.focus_modules.map(translateModule).join(" / ")}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="font-serif text-2xl font-medium">{title}</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          ({count})
        </span>
      </div>
      {children}
    </section>
  )
}
