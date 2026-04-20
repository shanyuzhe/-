import { Headphones, Mic, BookOpen, PenLine } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Module } from "@/lib/types"

const ICON: Record<Module, React.ElementType> = {
  listening: Headphones,
  speaking: Mic,
  reading: BookOpen,
  writing: PenLine,
}

const TONE: Record<Module, string> = {
  listening: "bg-blue-50 text-blue-700",
  speaking: "bg-orange-50 text-orange-700",
  reading: "bg-emerald-50 text-emerald-700",
  writing: "bg-violet-50 text-violet-700",
}

export function ModuleIcon({
  module,
  className,
}: {
  module: Module
  className?: string
}) {
  const Icon = ICON[module]
  return (
    <div
      className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
        TONE[module],
        className
      )}
    >
      <Icon className="w-5 h-5" strokeWidth={1.75} />
    </div>
  )
}
