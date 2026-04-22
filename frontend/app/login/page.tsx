"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, LogIn } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"
import { setClientToken } from "@/lib/auth-client"

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next") || "/"
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await api.login({
        username: username.trim(),
        password,
      })
      setClientToken(res.access_token)
      toast.success(`欢迎回来,${res.username}`)
      router.replace(next)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // 精简错误提示:后端返 "用户名或密码错误"
      toast.error(
        msg.includes("401") ? "用户名或密码错误" : msg
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-20">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-medium tracking-tight">CCO</h1>
        <p className="text-sm text-muted-foreground mt-2">决策外包学习助手</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="账号">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
            <Field label="密码">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                minLength={6}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2
                    className="w-4 h-4 mr-1.5 animate-spin"
                    strokeWidth={1.75}
                  />
                  登录中
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
                  登录
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            还没账号?{" "}
            <Link
              href="/register"
              className="text-primary hover:underline"
            >
              用邀请码注册
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
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
