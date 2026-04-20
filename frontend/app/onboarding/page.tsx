"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import type { ExtractedPlan } from "@/lib/types"

type Step = 1 | 2 | 3

const AI_TOOLS = [
  {
    name: "Claude",
    url: "https://claude.ai",
    note: "推荐 · 推理强 + web search",
  },
  { name: "ChatGPT", url: "https://chatgpt.com", note: "备选" },
  { name: "Kimi", url: "https://kimi.com", note: "国内免费 · 带 web search" },
  { name: "豆包", url: "https://www.doubao.com", note: "国内备选" },
] as const

const SOURCE_LABEL: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  kimi: "Kimi",
  doubao: "豆包",
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [template, setTemplate] = useState<string>("")
  const [rawText, setRawText] = useState("")
  const [sourceAi, setSourceAi] = useState("claude")
  const [planId, setPlanId] = useState<number | null>(null)
  const [extracted, setExtracted] = useState<ExtractedPlan | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    api
      .planTemplate()
      .then((r) => setTemplate(r.template))
      .catch(() => toast.error("模板加载失败,请确认后端已启动"))
  }, [])

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(template)
      toast.success("模板已复制")
    } catch {
      toast.error("复制失败,请手动选中 Ctrl+C")
    }
  }

  async function parseText() {
    if (rawText.trim().length < 50) {
      toast.error("文本太短(至少 50 字)")
      return
    }
    setParsing(true)
    try {
      const res = await api.planImport({
        raw_text: rawText,
        source_ai: sourceAi,
      })
      setPlanId(res.plan_id)
      setExtracted(res.extracted)
      setWarnings(res.warnings)
      setStep(3)
    } catch (e) {
      toast.error(
        `解析失败: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setParsing(false)
    }
  }

  async function activate() {
    if (!planId) return
    setActivating(true)
    try {
      await api.planActivate(planId)
      toast.success("规划已激活,回到今天看新任务")
      router.push("/")
      router.refresh()
    } catch (e) {
      toast.error(
        `激活失败: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setActivating(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          返回今天
        </Link>
      </nav>

      <header className="mb-10">
        <p className="text-sm text-muted-foreground">{step}/3</p>
        <h1 className="font-serif text-5xl font-medium tracking-tight mt-2">
          导入你的学习规划
        </h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          我们不做站内对话。请去 Claude / ChatGPT / Kimi 等主流 AI(借它们的 web search 能力)
          聊一份个性化规划,再回来粘贴。
        </p>
      </header>

      {/* --- Step 1 --- */}
      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-serif text-2xl font-medium">① 复制 Prompt 模板</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground/80">
                模板已为雅思备考写好结构(5 个 Section)。复制到任一主流 AI,按提示填入你的情况,就能拿到一份规划。
              </p>
              <div className="relative">
                <pre className="text-xs bg-muted/50 rounded-lg p-4 overflow-auto max-h-80 whitespace-pre-wrap font-mono border border-border/60">
                  {template || "加载中..."}
                </pre>
                <Button
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={copyTemplate}
                  disabled={!template}
                >
                  <Copy className="w-4 h-4 mr-1" strokeWidth={1.75} />
                  复制
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-serif text-2xl font-medium">② 去 AI 聊规划</h2>
            </CardHeader>
            <CardContent className="space-y-1">
              {AI_TOOLS.map((ai) => (
                <a
                  key={ai.name}
                  href={ai.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between py-3 px-3 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-medium">{ai.name}</span>
                    <span className="text-xs text-muted-foreground">{ai.note}</span>
                  </div>
                  <ExternalLink
                    className="w-4 h-4 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                </a>
              ))}
              <p className="text-xs text-muted-foreground pt-3 pl-3 leading-relaxed">
                聊 10-20 分钟,AI 会先反问你几个问题,再输出完整规划。
                <br />
                要求它严格按 Section A/B/C/D/E 5 节结构输出,最后一份整段复制回来。
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} size="lg">
              下一步:粘贴 AI 回复
            </Button>
          </div>
        </div>
      )}

      {/* --- Step 2 --- */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-serif text-2xl font-medium">③ 粘贴 AI 回复</h2>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-sm font-medium">你用的是哪家 AI?</label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {Object.keys(SOURCE_LABEL).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSourceAi(k)}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-sm border-2 transition-colors",
                        sourceAi === k
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {SOURCE_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">
                  整段粘贴 AI 给你的规划(含 Section A/B/C/D/E)
                </label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={16}
                  placeholder="直接粘贴..."
                  className="mt-2 font-mono text-xs leading-relaxed"
                />
                <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
                  {rawText.length} 字符
                  {rawText.length < 50 && (
                    <span className="text-destructive ml-2">(至少 50 字)</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← 上一步
            </Button>
            <Button
              onClick={parseText}
              disabled={parsing || rawText.trim().length < 50}
              size="lg"
            >
              {parsing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  解析中(DeepSeek-R1,约 30 秒)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  解析
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* --- Step 3 --- */}
      {step === 3 && extracted && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-serif text-2xl font-medium flex items-center gap-2">
                <Check
                  className="w-6 h-6 text-primary"
                  strokeWidth={2}
                />
                解析结果
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                科目:{extracted.subject}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {warnings.length > 0 && (
                <div className="border-l-2 border-destructive bg-destructive/5 pl-3 py-2 text-xs text-destructive space-y-0.5">
                  {warnings.map((w, i) => (
                    <p key={i}>⚠ {w}</p>
                  ))}
                </div>
              )}

              <PreviewSection title={`阶段(${extracted.phases.length})`}>
                {extracted.phases.map((p, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium">
                      {p.name}{" "}
                      <span className="text-muted-foreground font-normal tabular-nums text-xs">
                        ({p.start_date} → {p.end_date})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      focus: {p.focus_modules.join(", ")}
                      {p.objectives && ` · ${p.objectives}`}
                    </p>
                  </div>
                ))}
              </PreviewSection>

              <Separator />

              <PreviewSection title={`资源推荐(${extracted.resources.length})`}>
                {extracted.resources.slice(0, 8).map((r, i) => (
                  <div key={i} className="text-sm">
                    <p>
                      <span className="font-medium">{r.name}</span>
                      <Badge
                        variant="secondary"
                        className="ml-2 text-xs font-normal"
                      >
                        {r.type}
                      </Badge>
                      {r.phase && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          [{r.phase}]
                        </span>
                      )}
                    </p>
                    {r.why && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.why}
                      </p>
                    )}
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        {r.url}
                      </a>
                    )}
                  </div>
                ))}
                {extracted.resources.length > 8 && (
                  <p className="text-xs text-muted-foreground">
                    …以及其他 {extracted.resources.length - 8} 项
                  </p>
                )}
              </PreviewSection>

              <Separator />

              <PreviewSection
                title={`每日 habit(${extracted.daily_habits.length})`}
              >
                {extracted.daily_habits.map((h, i) => (
                  <p key={i} className="text-sm">
                    <span className="font-medium">{h.habit}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {[h.tool, h.amount, h.timing]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                ))}
              </PreviewSection>

              <Separator />

              <PreviewSection
                title={`任务原则(${extracted.task_principles.length})`}
              >
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {extracted.task_principles.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </PreviewSection>

              <Separator />

              <PreviewSection
                title={`自检节点(${extracted.checkpoints.length})`}
              >
                {extracted.checkpoints.map((c, i) => (
                  <p key={i} className="text-sm">
                    <span className="font-medium tabular-nums">{c.date}</span>
                    <Badge
                      variant="secondary"
                      className="ml-2 text-xs font-normal"
                    >
                      {c.type}
                    </Badge>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {[c.material, c.target].filter(Boolean).join(" · ")}
                    </span>
                  </p>
                ))}
              </PreviewSection>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={() => setStep(2)}>
              ← 重新粘贴
            </Button>
            <Button
              onClick={activate}
              disabled={activating}
              size="lg"
            >
              {activating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  激活中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" strokeWidth={2} />
                  采纳并激活
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}

function PreviewSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </p>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}
