"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"
import type { DailyHabit } from "@/lib/types"

const EMPTY_HABIT: DailyHabit = { habit: "", tool: "", amount: "", timing: "" }

export default function HabitsEditor({
  planId,
  habits: initial,
}: {
  planId: number
  habits: DailyHabit[]
}) {
  const router = useRouter()
  const [habits, setHabits] = useState<DailyHabit[]>(initial)
  const [dirty, setDirty] = useState(false)
  const [saving, startSaving] = useTransition()

  function update(i: number, patch: Partial<DailyHabit>) {
    setHabits(habits.map((h, idx) => (idx === i ? { ...h, ...patch } : h)))
    setDirty(true)
  }

  function remove(i: number) {
    setHabits(habits.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  function add() {
    setHabits([...habits, { ...EMPTY_HABIT }])
    setDirty(true)
  }

  function save() {
    const clean = habits
      .map((h) => ({
        habit: h.habit.trim(),
        tool: h.tool?.trim() || undefined,
        amount: h.amount?.trim() || undefined,
        timing: h.timing?.trim() || undefined,
      }))
      .filter((h) => h.habit)
    startSaving(async () => {
      try {
        await api.planPatchHabits(planId, { habits: clean })
        toast.success(`已保存 ${clean.length} 条 habit`)
        setDirty(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {habits.map((h, i) => (
          <Card key={i} className="relative">
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  value={h.habit}
                  onChange={(e) => update(i, { habit: e.target.value })}
                  placeholder="habit"
                  className="flex-1 rounded-md border border-transparent hover:border-border focus:border-border bg-transparent px-2 py-1 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={() => remove(i)}
                  className="opacity-40 hover:opacity-100 hover:text-destructive transition-colors p-0.5 -m-0.5 rounded"
                  aria-label="删除这条 habit"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <input
                  value={h.tool ?? ""}
                  onChange={(e) => update(i, { tool: e.target.value })}
                  placeholder="tool"
                  className="rounded-md border border-transparent hover:border-border focus:border-border bg-transparent px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  value={h.amount ?? ""}
                  onChange={(e) => update(i, { amount: e.target.value })}
                  placeholder="amount"
                  className="rounded-md border border-transparent hover:border-border focus:border-border bg-transparent px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  value={h.timing ?? ""}
                  onChange={(e) => update(i, { timing: e.target.value })}
                  placeholder="timing"
                  className="rounded-md border border-transparent hover:border-border focus:border-border bg-transparent px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
          添加 habit
        </Button>
        {dirty && (
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2
                  className="w-3.5 h-3.5 mr-1 animate-spin"
                  strokeWidth={1.75}
                />
                保存中
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
                保存改动
              </>
            )}
          </Button>
        )}
        {dirty && !saving && (
          <span className="text-xs text-muted-foreground">有未保存的改动</span>
        )}
      </div>
    </div>
  )
}
