import Link from "next/link"
import { ArrowLeft, Lightbulb } from "lucide-react"

export const metadata = {
  title: "常见问题 — CCO",
  description: "CCO 决策外包学习助手常见问题",
}

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "邀请码从哪里拿?",
    a: (
      <>
        当前内测阶段,新账号需要管理员分发邀请码。找你认识的现有用户或管理员要。
        邀请码一次有效,用掉就失效。
      </>
    ),
  },
  {
    q: "为什么不是 CCO 自己生成规划,还要我去和别的 AI 聊?",
    a: (
      <>
        因为<strong>长对话比一次性指令好</strong>。一个好的学习规划需要 10-20 分钟的来回问答:
        你的目标、每日时长、基础、弱点、资源偏好...Claude / Kimi 在这种"慢聊"上比我们自己做的 prompt 稳。
        <br />
        我们的位置是<strong>执行端</strong>:拿你聊出来的规划 → 每天翻译成具体任务 → 跟踪反馈 → 调整节奏。
      </>
    ),
  },
  {
    q: "一天只有 3-5 张任务会不会太少?",
    a: (
      <>
        这是刻意设计。任务越多越容易变成"清单地狱",完成 10 张里的 7 张比完成 5 张里的 5 张对心态伤害更大。
        如果你觉得太少,在 plan 的"每日时长"里调高,或者在 /plan 页改阶段 focus_modules 让 AI 覆盖更多模块。
      </>
    ),
  },
  {
    q: "今天临时不想做某个模块,或者想加点别的,怎么办?",
    a: (
      <>
        两种方式:
        <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
          <li>
            <strong>点"跳过"</strong> — 当前任务不做,填备注说明。明天 AI 会根据跳过记录调整。
          </li>
          <li>
            <strong>去 /plan 改原则</strong> — 加一条像"今天不做口语"的原则,然后回首页点"重新生成"。
          </li>
        </ul>
        要彻底换目标(比如雅思 → 408),重新粘一份规划走 /onboarding 导入流程。
      </>
    ),
  },
  {
    q: "我的数据是完全隔离的吗?",
    a: (
      <>
        是。每个 API 端点都有严格的 user_id 过滤,另一个用户即使知道你的 plan/task id 也访问不了。
        我们的隔离测试脚本会模拟"攻击者用合法 token 访问别人资源",所有路径必须返 404 或 401 才能通过。
        当前 14/14 全通过。
        <br />
        <span className="text-sm text-muted-foreground">
          但注意:数据库文件本身不加密,管理员(我)能直接读。商业场景需要别的设计。
        </span>
      </>
    ),
  },
  {
    q: "忘记密码了怎么办?",
    a: (
      <>
        当前版本没有自助密码重置(没做邮箱/手机号)。联系管理员,会帮你重置。
        <br />
        小提示:登录 token(cookie)30 天过期,换新设备才要重新输密码。
      </>
    ),
  },
  {
    q: "退出登录 / 切换账号?",
    a: (
      <>
        首页右上角的"退出"按钮。点了会清掉 cookie,自动跳回登录页。想切号直接登录另一个账号即可。
      </>
    ),
  },
  {
    q: '任务为什么一整天不变?点"重新生成"要调 LLM 吗?',
    a: (
      <>
        是的,每日任务生成<strong>幂等</strong>:同一天只调一次 DeepSeek V3。默认进首页就是昨晚/今早生成的那批。
        <br />
        点右上"重新生成"会强制调 V3 重新出一份(约 30 秒)。适合:你临时改了 plan、感觉今天的任务和实际状态脱节、
        或者昨天反馈信息很多想让 AI 重算。
      </>
    ),
  },
  {
    q: "AI 评语和每周轨迹数据从哪来?",
    a: (
      <>
        <strong>每周轨迹</strong>和<strong>完成率 / 感受</strong>是后端从你 task 表聚合出来的纯 SQL,零 LLM。
        <br />
        <strong>AI 评语</strong>(/progress 底部那段 80-130 字)是 V3 读你 7 天任务详情 + 每周轨迹 + 模块热度后
        生成的。24 小时内缓存,不会每次刷新都烧 token。
      </>
    ),
  },
]

export default function FaqPage() {
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

      <header className="mb-8">
        <p className="text-sm text-muted-foreground">FAQ</p>
        <h1 className="font-serif text-5xl font-medium tracking-tight mt-2">
          常见问题
        </h1>
      </header>

      <div className="mb-10 rounded-xl border border-primary/30 bg-primary/5 p-5">
        <div className="flex gap-3 items-start">
          <Lightbulb
            className="w-5 h-5 text-primary shrink-0 mt-0.5"
            strokeWidth={1.75}
          />
          <div className="space-y-1.5">
            <p className="font-serif text-base font-medium text-foreground">
              没找到你要的答案?
            </p>
            <p className="text-sm text-foreground/75 leading-relaxed">
              这里列的是大家<strong className="text-foreground">最常问的</strong>。
              当前内测阶段,没在下面的问题直接
              <strong className="text-foreground">联系管理员</strong>
              (通过邀请码渠道),我们会根据反馈补充条目。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {faqs.map((item, i) => (
          <section key={i}>
            <h2 className="font-serif text-xl font-medium leading-snug">
              <span className="text-muted-foreground/70 mr-2 tabular-nums text-sm">
                {String(i + 1).padStart(2, "0")}
              </span>
              {item.q}
            </h2>
            <div className="mt-3 text-[15px] leading-relaxed text-foreground/85 pl-7">
              {item.a}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 pt-8 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          没解决你的疑问?看看{" "}
          <Link
            href="/guide"
            className="text-primary hover:underline underline-offset-2"
          >
            5 分钟上手指南
          </Link>
          ,或直接联系管理员。
        </p>
      </div>
    </main>
  )
}
