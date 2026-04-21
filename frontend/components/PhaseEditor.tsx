"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { PhaseData } from "@/lib/types"

const MODULE_LABEL: Record<string, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
}

function translateModule(m: string): string {
  return MODULE_LABEL[m] ?? m
}

export default function PhaseEditor({
  planId,
  phases,
}: {
  planId: number
  phases: PhaseData[]
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  return (
    <div className="space-y-3">
      {phases.map((p, i) => (
        <Card key={i} className="group relative">
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h3 className="font-medium text-lg">{p.name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {p.start_date} → {p.end_date}
                </span>
                <button
                  onClick={() => setEditingIndex(i)}
                  className="opacity-40 hover:opacity-100 transition-opacity p-1 -m-1 rounded"
                  aria-label={`编辑 ${p.name}`}
                >
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {p.focus_modules.map((m) => (
                <Badge key={m} variant="secondary" className="font-normal">
                  {translateModule(m)}
                </Badge>
              ))}
            </div>
            {p.objectives && (
              <p className="text-sm text-foreground/80 mt-2">{p.objectives}</p>
            )}
          </CardContent>
        </Card>
      ))}

      {editingIndex !== null && (
        <PhaseEditDialog
          planId={planId}
          index={editingIndex}
          phase={phases[editingIndex]}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  )
}

function PhaseEditDialog({
  planId,
  index,
  phase,
  onClose,
}: {
  planId: number
  index: number
  phase: PhaseData
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(phase.name)
  const [startDate, setStartDate] = useState(phase.start_date)
  const [endDate, setEndDate] = useState(phase.end_date)
  const [objectives, setObjectives] = useState(phase.objectives ?? "")
  const [modules, setModules] = useState<string[]>([...phase.focus_modules])
  const [moduleInput, setModuleInput] = useState("")
  const [saving, setSaving] = useState(false)

  function addModule() {
    const m = moduleInput.trim()
    if (!m || modules.includes(m)) {
      setModuleInput("")
      return
    }
    setModules([...modules, m])
    setModuleInput("")
  }

  function removeModule(m: string) {
    setModules(modules.filter((x) => x !== m))
  }

  async function save() {
    setSaving(true)
    try {
      await api.planPatchPhase(planId, index, {
        name: name.trim() || phase.name,
        start_date: startDate,
        end_date: endDate,
        focus_modules: modules,
        objectives: objectives,
      })
      toast.success(`已保存:${name}`)
      router.refresh()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">编辑阶段</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Field label="名称">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="开始日期">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
            <Field label="结束日期">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
          </div>

          <Field label="重点模块">
            <div className="flex gap-1.5 flex-wrap mb-2">
              {modules.map((m) => (
                <Badge
                  key={m}
                  variant="secondary"
                  className="font-normal pr-1 gap-1"
                >
                  {translateModule(m)}
                  <button
                    onClick={() => removeModule(m)}
                    className="hover:text-destructive transition-colors"
                    aria-label={`删除 ${m}`}
                  >
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={moduleInput}
                onChange={(e) => setModuleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addModule()
                  }
                }}
                placeholder="输入模块名,回车添加"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addModule}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              </Button>
            </div>
          </Field>

          <Field label="目标(可选)">
            <Textarea
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              rows={3}
              placeholder="这个阶段要达到什么?"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2
                  className="w-3.5 h-3.5 mr-1.5 animate-spin"
                  strokeWidth={1.75}
                />
                保存中
              </>
            ) : (
              "保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground mb-1.5">
        {label}
      </span>
      {children}
    </label>
  )
}
