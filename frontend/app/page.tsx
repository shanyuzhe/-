import Link from "next/link"
import { Check, Sparkles } from "lucide-react"
import { api } from "@/lib/api"
import { TaskCard } from "@/components/TaskCard"
import { RefreshTasksButton } from "@/components/RefreshTasksButton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { Module, PlanOut, TodayResponse } from "@/lib/types"

const MODULE_LABEL: Record<Module, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
}

const SOURCE_LABEL: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  kimi: "Kimi",
  doubao: "豆包",
}

export default async function TodayPage() {
  let data: TodayResponse
  let plan: PlanOut | null = null

  try {
    data = await api.today()
  } catch (e) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-serif text-3xl font-medium">无法连接后端</h1>
        <p className="text-sm text-muted-foreground mt-2">
          请确认后端已启动:
          <code className="ml-2 px-2 py-0.5 rounded bg-muted">
            cd backend && uvicorn app.main:app --reload
          </code>
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          {e instanceof Error ? e.message : String(e)}
        </p>
      </main>
    )
  }

  try {
    plan = await api.planActive()
  } catch {
    // plan 查询失败不阻塞首页
    plan = null
  }

  const done = data.tasks.filter((t) => t.status === "done").length
  const total = data.tasks.length

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {data.phase_name} · 距考试 {data.days_to_exam} 天
            </p>
            <h1 className="font-serif text-5xl font-medium tracking-tight mt-2">
              今天
            </h1>
          </div>
          <nav className="flex gap-1 items-center">
            <RefreshTasksButton />
            <Link
              href="/plan"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              规划
            </Link>
            <Link
              href="/progress"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              进度
            </Link>
          </nav>
        </div>

        <div className="mt-6 flex items-center gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground tabular-nums">
            {done}/{total} · {Math.round(data.completion_rate * 100)}%
          </p>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex gap-1.5 items-center">
            <span className="text-xs text-muted-foreground">本期重点</span>
            {data.phase_focus.map((m) => (
              <Badge key={m} variant="secondary" className="font-normal">
                {MODULE_LABEL[m]}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      {/* 规划状态:没 plan 时显示 CTA,有 plan 时显示小 badge */}
      {!plan && (
        <Link href="/onboarding">
          <div className="mb-8 p-5 border border-primary/30 bg-primary/5 rounded-xl flex items-center justify-between gap-4 hover:bg-primary/10 transition-colors cursor-pointer">
            <div className="flex-1 min-w-0">
              <p className="font-serif text-lg font-medium">
                还在用默认规划?
              </p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                去 Claude / Kimi 聊一份个性化规划(10-20 分钟),让任务含具体资源 —— UP 主课、App、书、自检节点。
              </p>
            </div>
            <Sparkles
              className="w-6 h-6 text-primary shrink-0"
              strokeWidth={1.75}
            />
          </div>
        </Link>
      )}

      {plan && (
        <div className="mb-8 text-xs text-muted-foreground flex items-center gap-2">
          <Check
            className="w-3.5 h-3.5 text-primary"
            strokeWidth={2.5}
          />
          基于你从 {SOURCE_LABEL[plan.source_ai ?? ""] ?? "AI"} 导入的规划
          <span className="text-muted-foreground/60">·</span>
          <Link
            href="/onboarding"
            className="underline-offset-2 hover:underline hover:text-foreground"
          >
            重新导入
          </Link>
        </div>
      )}

      {/* 任务列表 */}
      <div className="space-y-4">
        {data.tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm py-12 text-center">
            今天还没有任务。点右上角刷新生成。
          </p>
        ) : (
          data.tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </main>
  )
}
