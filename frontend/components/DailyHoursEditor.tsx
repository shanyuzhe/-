"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Check, X, Loader2, Clock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"

export default function DailyHoursEditor({
  planId,
  initial,
}: {
  planId: number
  initial: number | null | undefined
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<string>(
    initial != null ? String(initial) : ""
  )
  const [saving, setSaving] = useState(false)

  async function save() {
    const n = parseFloat(value)
    if (isNaN(n) || n < 0.5 || n > 24) {
      toast.error("请输入 0.5-24 之间的数字")
      return
    }
    setSaving(true)
    try {
      await api.planPatchDailyHours(planId, { daily_hours: n })
      toast.success(`每日学习时长已更新为 ${n} 小时`)
      setEditing(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setValue(initial != null ? String(initial) : "")
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="w-4 h-4 text-primary shrink-0" strokeWidth={1.75} />
      <span className="text-muted-foreground">每日学习时长</span>
      {editing ? (
        <>
          <input
            type="number"
            min={0.5}
            max={24}
            step={0.5}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                save()
              }
              if (e.key === "Escape") cancel()
            }}
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-xs text-muted-foreground">小时</span>
          <Button size="sm" variant="ghost" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Check className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={cancel}
            disabled={saving}
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </Button>
        </>
      ) : (
        <>
          <span className="font-serif text-lg font-medium tabular-nums">
            {initial != null ? initial : "—"}
          </span>
          <span className="text-xs text-muted-foreground">小时</span>
          <button
            onClick={() => setEditing(true)}
            className="opacity-40 hover:opacity-100 transition-opacity p-1 -m-1 rounded ml-1"
            aria-label="编辑每日学习时长"
          >
            <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </>
      )}
    </div>
  )
}
