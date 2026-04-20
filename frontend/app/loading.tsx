import { Skeleton } from "@/components/ui/skeleton"

/**
 * 首页 SSR 加载态(Next.js 约定)
 * 当 Server Component 在等 /today(V3 首次生成 30 秒)时显示
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-12 w-24 mt-3" />
        <div className="mt-6 flex items-center gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
      </header>

      <div className="mb-8 p-5 border border-primary/20 bg-primary/5 rounded-xl">
        <p className="font-serif text-base font-medium">
          V3 正在为你生成今日任务
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          通常 30 秒左右 · 如果首次加载可能慢一点
        </p>
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-border/60 rounded-lg p-6 space-y-3"
          >
            <div className="flex items-start gap-4">
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    </main>
  )
}
