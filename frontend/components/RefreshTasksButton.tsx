"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export function RefreshTasksButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      await api.today(true)
      toast.success("已重新生成今日任务")
      router.refresh()
    } catch (e) {
      toast.error(`刷新失败:${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={refresh}
      disabled={loading}
      aria-label="重新生成"
    >
      <RefreshCw
        className={cn("w-4 h-4", loading && "animate-spin")}
        strokeWidth={1.75}
      />
    </Button>
  )
}
