"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"

export default function PrinciplesEditor({
  planId,
  principles: initial,
}: {
  planId: number
  principles: string[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(initial.join("\n"))
  const [saving, startSaving] = useTransition()

  function startEdit() {
    setText(initial.join("\n"))
    setEditing(true)
  }

  function save() {
    const principles = text
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean)
    startSaving(async () => {
      try {
        await api.planPatchPrinciples(planId, { principles })
        toast.success(`已保存 ${principles.length} 条原则`)
        setEditing(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      }
    })
  }

  if (!editing) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ul className="space-y-2 text-sm">
            {initial.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary shrink-0 mt-0.5">·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
              编辑
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <p className="text-xs text-muted-foreground">每行一条,空行会被忽略</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={Math.max(6, text.split("\n").length + 1)}
          className="font-mono text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            <X className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
            取消
          </Button>
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
                保存
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
