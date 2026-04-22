"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Plus,
  Copy,
  Check,
  Loader2,
  KeyRound,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api"
import type { Invitation } from "@/lib/types"

function formatTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const h = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${day} ${h}:${min}`
}

export default function AdminInvitationsPage() {
  const router = useRouter()
  const [list, setList] = useState<Invitation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [count, setCount] = useState(1)
  const [note, setNote] = useState("")
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  async function load() {
    try {
      const data = await api.adminListInvitations()
      setList(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("403")) {
        toast.error("仅管理员可访问")
        router.replace("/")
        return
      }
      setError(msg)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function create() {
    if (count < 1 || count > 20) {
      toast.error("数量必须在 1-20 之间")
      return
    }
    startSaving(async () => {
      try {
        const created = await api.adminCreateInvitations({
          count,
          note: note.trim() || undefined,
        })
        toast.success(`生成 ${created.length} 个邀请码`)
        setDialogOpen(false)
        setNote("")
        setCount(1)
        await load()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e))
      }
    })
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1500)
    } catch {
      toast.error("复制失败,手动复制")
    }
  }

  const unusedCount = list?.filter((i) => i.status === "unused").length ?? 0
  const usedCount = list?.filter((i) => i.status === "used").length ?? 0

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <nav className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          返回今天
        </Link>
      </nav>

      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">Admin</p>
          <h1 className="font-serif text-5xl font-medium tracking-tight mt-2">
            邀请码
          </h1>
          {list && (
            <p className="text-sm text-muted-foreground mt-3 tabular-nums">
              共 {list.length} 个 · 未用 {unusedCount} · 已用 {usedCount}
            </p>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
          生成邀请码
        </Button>
      </header>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {list === null && !error && (
        <p className="text-sm text-muted-foreground">加载中...</p>
      )}

      {list && list.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <KeyRound
              className="w-10 h-10 text-muted-foreground mx-auto mb-3"
              strokeWidth={1.5}
            />
            <p className="text-sm text-muted-foreground">
              还没有邀请码,点右上角"生成"
            </p>
          </CardContent>
        </Card>
      )}

      {list && list.length > 0 && (
        <div className="space-y-2">
          {list.map((inv) => (
            <Card
              key={inv.code}
              className={
                inv.status === "used" ? "opacity-60" : ""
              }
            >
              <CardContent className="pt-6 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => copyCode(inv.code)}
                  className="inline-flex items-center gap-1.5 font-mono text-sm px-3 py-1.5 rounded-md bg-muted hover:bg-muted/60 transition-colors"
                  title="点击复制"
                >
                  {inv.code}
                  {copiedCode === inv.code ? (
                    <Check
                      className="w-3.5 h-3.5 text-primary"
                      strokeWidth={2}
                    />
                  ) : (
                    <Copy
                      className="w-3.5 h-3.5 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                  )}
                </button>

                {inv.status === "unused" ? (
                  <Badge variant="secondary" className="text-xs">
                    未用
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    已用
                  </Badge>
                )}

                {inv.note && (
                  <span className="text-xs text-muted-foreground">
                    📝 {inv.note}
                  </span>
                )}

                <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                  {inv.status === "used" ? (
                    <>
                      {inv.used_by_username} · {formatTime(inv.used_at)}
                    </>
                  ) : (
                    <>生成于 {formatTime(inv.created_at)}</>
                  )}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(v) => {
          if (!saving) setDialogOpen(v)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">生成邀请码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="block">
              <span className="block text-xs text-muted-foreground mb-1.5">
                数量(1-20)
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground mb-1.5">
                备注(可选,记录给谁或什么场景)
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={100}
                placeholder="如:给张三 / W1 测试批"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button onClick={create} disabled={saving}>
              {saving ? (
                <>
                  <Loader2
                    className="w-4 h-4 mr-1.5 animate-spin"
                    strokeWidth={1.75}
                  />
                  生成中
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
                  生成 {count} 个
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
