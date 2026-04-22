"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Loader2, Save, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import type { Resource } from "@/lib/types"

const TYPE_OPTIONS = [
  "视频课",
  "App",
  "书籍",
  "网站",
  "播客",
  "工具",
  "服务",
  "其他",
]

const EMPTY: Resource = {
  name: "",
  url: "",
  type: "其他",
  why: "",
  phase: "",
}

export default function ResourcesEditor({
  planId,
  resources: initial,
}: {
  planId: number
  resources: Resource[]
}) {
  const router = useRouter()
  const [list, setList] = useState<Resource[]>(initial)
  const [dirty, setDirty] = useState(false)
  const [saving, startSaving] = useTransition()

  function update(i: number, patch: Partial<Resource>) {
    setList(list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  function remove(i: number) {
    setList(list.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  function add() {
    setList([...list, { ...EMPTY }])
    setDirty(true)
  }

  function save() {
    const clean = list
      .map((r) => ({
        name: r.name.trim(),
        url: r.url?.trim() || null,
        type: r.type?.trim() || "其他",
        why: r.why?.trim() || null,
        phase: r.phase?.trim() || null,
      }))
      .filter((r) => r.name)
    startSaving(async () => {
      try {
        await api.planPatchResources(planId, { resources: clean })
        toast.success(`已保存 ${clean.length} 条资源`)
        setDirty(false)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {list.map((r, i) => (
          <Card key={i} className="relative">
            <CardContent className="pt-6 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="资源名称"
                  className="flex-1 rounded-md border border-transparent hover:border-border focus:border-border bg-transparent px-2 py-1 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <select
                  value={r.type ?? "其他"}
                  onChange={(e) => update(i, { type: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => remove(i)}
                  className="opacity-40 hover:opacity-100 hover:text-destructive transition-colors p-0.5 -m-0.5 rounded"
                  aria-label="删除这条资源"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ExternalLink className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                <input
                  value={r.url ?? ""}
                  onChange={(e) => update(i, { url: e.target.value })}
                  placeholder="URL / 获取方式(如 实体书电商平台获取)"
                  className="flex-1 rounded-md border border-transparent hover:border-border focus:border-border bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <input
                value={r.phase ?? ""}
                onChange={(e) => update(i, { phase: e.target.value })}
                placeholder="建议阶段(如 阶段一、阶段二 或 全阶段贯穿)"
                className="w-full rounded-md border border-transparent hover:border-border focus:border-border bg-transparent px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />

              <Textarea
                value={r.why ?? ""}
                onChange={(e) => update(i, { why: e.target.value })}
                rows={2}
                placeholder="推荐理由"
                className="text-xs"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={add}>
          <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
          添加资源
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
