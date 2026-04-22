"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"
import { setClientToken } from "@/lib/auth-client"

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [invitationCode, setInvitationCode] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await api.register({
        username: username.trim(),
        password,
        invitation_code: invitationCode.trim(),
      })
      setClientToken(res.access_token)
      toast.success(`注册成功,欢迎 ${res.username}`)
      // 新用户直接去 onboarding 导入规划
      router.replace("/onboarding")
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // 从错误信息里猜 detail
      const m = msg.match(/\{[^}]*"detail":"([^"]+)"/)
      toast.error(m ? m[1] : msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-20">
      <div className="mb-10 text-center">
        <h1 className="font-serif text-4xl font-medium tracking-tight">
          注册账号
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          需要邀请码(内测阶段)
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="用户名" hint="3-50 字,字母/数字/下划线/短横">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                pattern="[A-Za-z0-9_\-]+"
                minLength={3}
                maxLength={50}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
            <Field label="密码" hint="至少 6 位">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                maxLength={128}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
            <Field label="邀请码" hint="格式 CCO-XXXX-XXXX">
              <input
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                required
                minLength={6}
                maxLength={32}
                placeholder="CCO-XXXX-XXXX"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                  注册中
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
                  注册
                </>
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            已有账号?{" "}
            <Link
              href="/login"
              className="text-primary hover:underline"
            >
              去登录
            </Link>
          </p>
        </CardContent>
      </Card>

      <div className="mt-8 flex justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/guide" className="hover:text-foreground transition-colors">
          使用指南
        </Link>
        <span className="text-muted-foreground/40">·</span>
        <Link href="/faq" className="hover:text-foreground transition-colors">
          常见问题
        </Link>
      </div>
    </main>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && (
          <span className="text-[10px] text-muted-foreground/70">{hint}</span>
        )}
      </div>
      {children}
    </label>
  )
}
