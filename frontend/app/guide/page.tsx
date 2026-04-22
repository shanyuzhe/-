import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  KeyRound,
  FileText,
  Sparkles,
  CheckCheck,
  Calendar,
  LineChart,
} from "lucide-react"

export const metadata = {
  title: "用户指南 — CCO",
  description: "5 分钟上手 CCO 决策外包学习助手",
}

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          返回
        </Link>
      </nav>

      <header className="mb-12">
        <p className="text-sm text-muted-foreground">User Guide</p>
        <h1 className="font-serif text-5xl font-medium tracking-tight mt-2">
          5 分钟上手
        </h1>
        <p className="text-base text-muted-foreground mt-4 leading-relaxed">
          CCO 是你的<strong className="text-foreground">决策外包助手</strong>——
          让 AI 决定你每天该做什么,你只管执行。不教学,不测评,只帮你
          <strong className="text-foreground">减少"今天学什么"的心智负担</strong>。
        </p>
      </header>

      <div className="space-y-14">
        <Step
          index={1}
          icon={<KeyRound className="w-5 h-5" strokeWidth={1.75} />}
          title="拿到邀请码并注册"
          image="step-1-register.png"
          alt="注册页面"
        >
          <p>
            当前阶段内测,新账号需要<strong>邀请码</strong>(形如{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
              CCO-XXXX-XXXX
            </code>
            )。找管理员拿到后,去{" "}
            <Link
              href="/register"
              className="text-primary hover:underline underline-offset-2"
            >
              注册页
            </Link>
            :填用户名 + 密码 + 邀请码,一次完成。
          </p>
          <p className="text-sm text-muted-foreground">
            用户名 3-50 位,字母数字下划线;密码至少 6 位。
          </p>
        </Step>

        <Step
          index={2}
          icon={<FileText className="w-5 h-5" strokeWidth={1.75} />}
          title="和外部 AI 聊出你的学习规划"
          image="step-2-chat-with-ai.png"
          alt="和 Claude/Kimi 聊规划"
        >
          <p>
            CCO 不自己生成规划——我们更相信 Claude / Kimi 这种<strong>长对话能力强</strong>
            的模型在 10-20 分钟的深聊里能拿到你的真实情况。
          </p>
          <p>
            在 /onboarding 页复制 prompt 模板,粘到 Claude / ChatGPT / Kimi / 豆包,按模板里的 5 轮问答
            聊完,最后 AI 会输出一份结构化规划(阶段、资源、习惯、原则、检查点)。
          </p>
          <p className="text-sm text-muted-foreground">
            工时约 10-20 分钟,主要是你自己想清楚"我到底多少时间、什么水平、哪些弱"。
          </p>
        </Step>

        <Step
          index={3}
          icon={<Sparkles className="w-5 h-5" strokeWidth={1.75} />}
          title="把 AI 规划粘回 CCO,等 90 秒提取"
          image="step-3-import-plan.png"
          alt="导入规划"
        >
          <p>
            把外部 AI 给你的完整规划原文粘贴到 /onboarding 第二步,点"开始解析"。后端的 DeepSeek V3
            会用约 <strong>90 秒</strong>把原文拆成结构化 JSON:阶段表、资源清单、每日习惯、任务生成原则、自检节点。
          </p>
          <p className="text-sm text-muted-foreground">
            解析期间会显示进度条,不要关闭页面。解析完成后你能看到预览,包括缺失字段的警告。
          </p>
        </Step>

        <Step
          index={4}
          icon={<CheckCheck className="w-5 h-5" strokeWidth={1.75} />}
          title="采纳激活,CCO 进入工作状态"
          image="step-4-activate.png"
          alt="采纳激活"
        >
          <p>
            看完预览没问题就点"采纳"。系统会:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li>归档旧规划(如果有)</li>
            <li>建立新阶段(phase 表)</li>
            <li>把 plan 的"每日时长"同步到你的账号</li>
            <li>清掉今天的旧任务,下一步会用新规划重新生成</li>
          </ul>
          <p>
            之后进入 /today 就能看到为你生成的今日任务。
          </p>
        </Step>

        <Step
          index={5}
          icon={<Calendar className="w-5 h-5" strokeWidth={1.75} />}
          title="每天做任务 + 反馈"
          image="step-5-today-tasks.png"
          alt="今日任务"
        >
          <p>
            每张任务卡都有:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li>
              <strong>module</strong> — 属于哪个模块(如 高数 / 翻译)
            </li>
            <li>
              <strong>estimated_minutes</strong> — AI 估算时长
            </li>
            <li>
              <strong>rationale</strong> — 为什么今天给你这张
            </li>
          </ul>
          <p>
            完成时:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm ml-2">
            <li>
              <strong>单击"完成"</strong> — 秒完成,感受默认 3/5,不弹窗
            </li>
            <li>
              <strong>长按 0.4 秒</strong> — 弹详情,可填实际用时 / 感受 1-5 / 备注
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            感受打分很重要:feeling ≤ 2 的任务明天会被 AI 设为"针对性复盘",低启动 + 半量。
          </p>
        </Step>

        <Step
          index={6}
          icon={<LineChart className="w-5 h-5" strokeWidth={1.75} />}
          title="看进度 + AI 评语"
          image="step-6-progress.png"
          alt="进度页"
        >
          <p>
            /progress 顶部是"总体状态":覆盖天数、完成率、平均感受、每周轨迹 sparkline、当前阶段进度。
          </p>
          <p>
            点底部的"生成评语"会让 V3 给你一段 80-130 字的评价,指出具体模式并给可执行建议
            (如"高数 feeling 3.2 最低,建议拆小单元 + 错题优先")。24 小时内缓存,再点就是重新生成。
          </p>
        </Step>
      </div>

      <div className="mt-16 pt-8 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          更多问题参见{" "}
          <Link
            href="/faq"
            className="text-primary hover:underline underline-offset-2"
          >
            常见问题
          </Link>
        </p>
      </div>
    </main>
  )
}

function Step({
  index,
  icon,
  title,
  image,
  alt,
  children,
}: {
  index: number
  icon: React.ReactNode
  title: string
  image: string
  alt: string
  children: React.ReactNode
}) {
  return (
    <section className="grid md:grid-cols-[auto_1fr] gap-6">
      <div className="shrink-0">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center tabular-nums">
          Step {index}
        </p>
      </div>
      <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
        <h2 className="font-serif text-2xl font-medium text-foreground">
          {title}
        </h2>
        {children}
        <div className="mt-4 rounded-xl border border-border/60 bg-card/40 overflow-hidden">
          <Image
            src={`/guide/${image}`}
            alt={alt}
            width={1200}
            height={720}
            className="w-full h-auto"
            priority={index === 1}
            // 截图缺失时浏览器显示 alt,不会崩
            unoptimized
          />
        </div>
      </div>
    </section>
  )
}
