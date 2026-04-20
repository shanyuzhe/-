"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import type { TaskOut } from "@/lib/types"

type Status = "done" | "skipped" | "swapped"

export function TaskFeedbackDialog({
  task,
  initialStatus,
  trigger,
}: {
  task: TaskOut
  initialStatus: Status
  trigger: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [actualMin, setActualMin] = useState<string>(
    task.estimated_minutes.toString()
  )
  const [feeling, setFeeling] = useState<number>(3)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const isSkip = initialStatus === "skipped"

  async function submit() {
    setSubmitting(true)
    try {
      await api.feedback({
        task_id: task.id,
        status: initialStatus,
        actual_minutes: isSkip ? undefined : parseInt(actualMin) || undefined,
        feeling: isSkip ? undefined : feeling,
        note: note || undefined,
      })
      toast.success(isSkip ? "已跳过" : "已完成")
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error(`提交失败:${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium">
            {isSkip ? "跳过这个任务" : "完成了"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{task.title}</p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {!isSkip && (
            <>
              <div>
                <label className="text-sm font-medium">
                  实际用时(分钟)
                </label>
                <input
                  type="number"
                  value={actualMin}
                  onChange={(e) => setActualMin(e.target.value)}
                  className="mt-2 w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium">感受</label>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFeeling(n)}
                      className={cn(
                        "w-11 h-11 rounded-full border-2 transition-all text-sm font-medium",
                        feeling === n
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  1 很累 · 3 一般 · 5 顺畅/满足
                </p>
              </div>
            </>
          )}

          <div>
            <label className="text-sm font-medium">
              想说点什么?
              <span className="text-muted-foreground font-normal">(可选)</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isSkip ? "为什么跳过?" : "哪里卡住了?哪里顺畅?"
              }
              className="mt-2"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "提交中..." : "提交"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
