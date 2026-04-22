import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ModuleIcon } from "./ModuleIcon"
import { TaskFeedbackDialog } from "./TaskFeedbackDialog"
import type { TaskOut } from "@/lib/types"

// 已知 module 翻译;未知(其他学科)的直接显示原文
const MODULE_LABEL: Record<string, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
}

// 根据 feeling 返回已完成卡片的背景色 class
function feelingBgClass(feeling: number | null | undefined): string {
  if (feeling == null) return ""
  if (feeling <= 2) return "bg-slate-100/50"
  if (feeling === 3) return ""
  if (feeling === 4) return "bg-amber-50/60"
  if (feeling >= 5) return "bg-primary/5"
  return ""
}

export function TaskCard({ task }: { task: TaskOut }) {
  const isDone = task.status === "done"
  const isSkipped = task.status === "skipped"
  const isSwapped = task.status === "swapped"
  const isPending = task.status === "pending"

  return (
    <Card
      className={cn(
        "border-border/60 transition-all",
        isDone && "opacity-60",
        isDone && feelingBgClass(task.feeling),
        (isSkipped || isSwapped) && "opacity-40 border-dashed"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <ModuleIcon module={task.module} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="secondary" className="text-xs font-normal">
                {MODULE_LABEL[task.module] ?? task.module}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {task.estimated_minutes} 分钟
              </span>
              {isDone && <Badge className="text-xs">已完成</Badge>}
              {isSkipped && (
                <Badge variant="outline" className="text-xs">
                  跳过
                </Badge>
              )}
            </div>
            <h3 className="font-serif text-xl font-medium leading-snug tracking-tight">
              {task.title}
            </h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
          {task.description}
        </p>

        {task.rationale && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-3 py-1">
            {task.rationale}
          </p>
        )}

        {isPending && (
          <div className="flex items-center gap-2 pt-2">
            <TaskFeedbackDialog
              task={task}
              initialStatus="done"
              trigger={<Button size="sm">完成</Button>}
            />
            <TaskFeedbackDialog
              task={task}
              initialStatus="skipped"
              trigger={
                <Button size="sm" variant="ghost">
                  跳过
                </Button>
              }
            />
          </div>
        )}

        {isDone && (
          <p className="text-xs text-muted-foreground">
            实际 {task.actual_minutes ?? "—"} 分钟
            {task.feeling ? ` · 感受 ${task.feeling}/5` : ""}
          </p>
        )}

        {task.note && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
            {task.note}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
