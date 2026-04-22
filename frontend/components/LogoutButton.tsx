"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { clearClientToken } from "@/lib/auth-client"

export default function LogoutButton() {
  const router = useRouter()

  function logout() {
    clearClientToken()
    // 强制从服务端重取页面,middleware 会把用户 redirect 到 /login
    router.replace("/login")
    router.refresh()
  }

  return (
    <button
      onClick={logout}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
      aria-label="退出登录"
    >
      <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
      退出
    </button>
  )
}
