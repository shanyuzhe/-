"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
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

// 长按阈值(毫秒)
const LONG_PRESS_MS = 400

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
  const router = useRouter()
  const isDone = task.status === "done"
  const isSkipped = task.status === "skipped"
  const isSwapped = task.status === "swapped"
  const isPending = task.status === "pending"

  // 长按相关 state/ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFiredRef = useRef(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [quickSubmitting, setQuickSubmitting] = useState(false)

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function startLongPress() {
    longPressFiredRef.current = false
    clearTimer()
    timerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(50)
        } catch {
          // 某些浏览器禁用 vibrate,忽略
        }
      }
      // 打开详情 Dialog(受控模式)
      setDetailOpen(true)
    }, LONG_PRESS_MS)
  }

  function cancelLongPress() {
    clearTimer()
  }

  async function quickDone() {
    // 若长按已触发,跳过单击
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false
      return
    }
    if (quickSubmitting) return
    setQuickSubmitting(true)
    try {
      await api.feedback({
        task_id: task.id,
        status: "done",
        feeling: 3,
      })
      toast.success("已完成")
      router.refresh()
    } catch (e) {
      toast.error(
        `提交失败:${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setQuickSubmitting(false)
    }
  }

  // 鼠标:按下开始计时,抬起/离开若未触发长按则算单击
  function onMouseDown() {
    startLongPress()
  }
  function onMouseUp() {
    const fired = longPressFiredRef.current
    cancelLongPress()
    if (!fired) {
      void quickDone()
    }
  }
  function onMouseLeave() {
    // 鼠标划出按钮:取消计时,且不触发单击
    cancelLongPress()
    longPressFiredRef.current = false
  }

  // 触摸:touchstart 开始,touchend 若未触发长按则单击;touchcancel 丢弃
  function onTouchStart(e: React.TouchEvent) {
    // 避免触摸后又触发 mouse 合成事件导致双提交
    e.preventDefault()
    startLongPress()
  }
  function onTouchEnd(e: React.TouchEvent) {
    e.preventDefault()
    const fired = longPressFiredRef.current
    cancelLongPress()
    if (!fired) {
      void quickDone()
    }
  }
  function onTouchCancel() {
    cancelLongPress()
    longPressFiredRef.current = false
  }

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
              <Badge
                variant="secondary"
                className="text-xs font-normal"
              >
                {MODULE_LABEL[task.module] ?? task.module}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {task.estimated_minutes} 分钟
              </span>
              {isDone && (
                <Badge className="text-xs">已完成</Badge>
              )}
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
          <div className="flex items-center gap-3 pt-2">
            <Button
              size="sm"
              disabled={quickSubmitting}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchCancel}
              // 默认 onClick 不再承载逻辑(由 mouseup/touchend 代替);
              // 键盘可访问性:保留 onClick 以支持 Enter/Space
              onClick={(e) => {
                // 若是鼠标触发(已由 mouseup 处理),跳过避免重复
                if (e.detail > 0) return
                void quickDone()
              }}
              aria-label="完成(单击快速完成;长按 0.4 秒填写详情)"
            >
              {quickSubmitting ? "提交中..." : "完成"}
            </Button>
            <span className="text-xs text-muted-foreground select-none">
              长按填详情
            </span>

            <TaskFeedbackDialog
              task={task}
              initialStatus="skipped"
              trigger={
                <Button size="sm" variant="ghost">
                  跳过
                </Button>
              }
            />

            {/* 详情 Dialog(受控,长按触达阈值后打开) */}
            <TaskFeedbackDialog
              task={task}
              initialStatus="done"
              open={detailOpen}
              onOpenChange={setDetailOpen}
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
