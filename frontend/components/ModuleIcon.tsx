import { BookOpen, Headphones, Mic, PenLine, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Module } from "@/lib/types"

// 雅思四模块的专属图标和配色
// 其他学科的 module(algorithm/vocab/grammar 等)fallback 到 Tag 图标 + 暖色
const ICON: Record<string, React.ElementType> = {
  listening: Headphones,
  speaking: Mic,
  reading: BookOpen,
  writing: PenLine,
}

const TONE: Record<string, string> = {
  listening: "bg-blue-50 text-blue-700",
  speaking: "bg-orange-50 text-orange-700",
  reading: "bg-emerald-50 text-emerald-700",
  writing: "bg-violet-50 text-violet-700",
}

const DEFAULT_TONE = "bg-amber-50 text-amber-700"

export function ModuleIcon({
  module,
  className,
}: {
  module: Module
  className?: string
}) {
  const Icon = ICON[module] ?? Tag
  const tone = TONE[module] ?? DEFAULT_TONE
  return (
    <div
      className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
        tone,
        className
      )}
    >
      <Icon className="w-5 h-5" strokeWidth={1.75} />
    </div>
  )
}
