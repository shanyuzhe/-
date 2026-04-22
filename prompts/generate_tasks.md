# 每日任务生成 Prompt(DeepSeek deepseek-chat)

用户状态全部以占位符 `{key}` 给出,调用前用 `str.format(**context)` 填充。

---

## USER 模板

<user_profile>
考试日期:{exam_date}(距今 {days_left} 天)
每日投入:{daily_hours} 小时
黄金时段:{prefer_slots}
弱点排序(最弱在前):{weakness_rank}
</user_profile>

<overall_progress>
目标:雅思 {target_score}
当前估值:{current_estimate}
</overall_progress>

<current_phase>
阶段:{phase_name}(Day {day_in_phase}/{phase_total_days})
重点模块:{phase_focus}
阶段目标任务数:{phase_target_tasks}(已完成 {phase_done_tasks})
</current_phase>

<last_7_days>
{recent_tasks_text}
</last_7_days>

<progress>
总体完成率: overall_rate_pct = {overall_rate_pct}
近 7 天完成率: recent_7d_rate_pct = {recent_7d_rate_pct}
</progress>

<last_week_summary>
{last_week_summary_text}
</last_week_summary>

<today>
日期:{today}
起始时段:{now_slot}
预计投入:{today_hours} 小时
</today>

<learning_plan>
{plan_context}
</learning_plan>

请生成今日 3-5 张任务卡。

**重要**:若 `<learning_plan>` 里有"任务生成必须遵守的原则"和"每天必须包含的习惯",**必须严格执行**,这是用户与 AI 共创的个性化要求,优先级高于默认规则。若包含"当前阶段推荐资源",任务的 `description` 里**优先引用这些具体资源**(例如 "顾家北听力 ep5"、"墨墨背单词 50 个")。

规则(严格遵守):
1. 覆盖今日预期时长的 80%-100%,留 20% 弹性
2. **total_time 硬上限(最重要约束)**:所有任务 `estimated_minutes` 累加 **必须 ≤ `{today_hours} × 60` 分钟**,单张 10-240 分钟。
   - 若 `<learning_plan>` 里的 habit 累加时长 **超过** today_hours,**必须按比例压缩每个 habit 的估算时长** —— 不能因为规划里写了"1 小时"就照搬。
   - `today_hours` 是用户最新调整的硬约束,优先级**高于**历史 habit 时长。
   - 若无法在 today_hours 内放入所有 habit,优先保留 focus_modules 里的 + 弱点排序靠前的,砍掉低优先级。
3. 优先修补**近 7 天跳过的任务**和**弱点排序靠前的模块**
4. 考虑当前时段精力(下午适合输入型如听力阅读,晚上适合输出型如写作口语)
5. **按完成率动态调量**(context 里的 `overall_rate_pct` 和 `recent_7d_rate_pct`):
   - `recent_7d_rate_pct < 40` 或 连续 3 天 < 50% → 砍半(3 张 + 总时长折半)
   - `recent_7d_rate_pct > 85` 且 `overall_rate_pct > 70` → 允许加 1 张更挑战性的任务
   - 其他情况按 today_hours 正常出
6. 不得编造用户状态;若 `last_7_days` 为"暂无",按新手保守节奏
7. **针对性复盘(硬规则)**:若 `<last_7_days>` 里存在:
   - `feeling ≤ 2` 的已完成任务(用户觉得吃力/挫败),或
   - `status=skipped` 的任务,
   今天至少生成 **1 张针对性复盘任务**。title 格式建议 `复盘:<原任务简述>`。
   规则:
   - **挫败型**(feeling ≤ 2):做**同题型半量 + 对照原文/答案**,不加新知识;`estimated_minutes` ≤ 原任务一半
   - **跳过型**(skipped):**低启动版本**(10-20 分钟即可,只做 50% 也算赢),降低心理门槛
   - `rationale_brief` 必须明确指出是针对哪条历史记录(如 "昨天高数 feeling=2,今天半量巩固概念")
8. 只输出 JSON,不要任何额外文字或 markdown 代码块包裹
9. **输出语言(硬规则)**:`title` / `description` / `rationale_brief` 必须是**自然流畅的中文**,面向终端用户阅读:
   - ❌ 禁止引用 prompt 里的 XML tag 名:如 `learning_plan` / `user_profile` / `current_phase` / `last_7_days`
   - ❌ 禁止出现英文术语:如 `habit` / `module` / `listening` / `speaking` / `focus_modules`
   - ❌ 不要说"遵循 learning_plan 的 habit 要求",要说"按规划里的每日习惯"或"按下午听力训练计划"
   - ✅ 用中文自然表达:模块、习惯、原则、时段、阶段

输出 JSON schema:
```
{{
  "tasks": [
    {{
      "module": string,  // 中文子能力名,必须是当前阶段 focus_modules 中的一个(如"听力"/"高数"/"数据结构"/"翻译")
      "title": "简短标题(≤200 字)",
      "description": "具体做什么,含材料建议、目标数量(≤2000 字)",
      "estimated_minutes": 10-120 整数,
      "rationale_brief": "一句话为什么选这个(≤200 字)"
    }}
  ]
}}
```

**module 命名规则**:严格从 learning_plan 的 `focus_modules` 里挑一个中文名,**不要使用英文**(如 "listening"),也不要发明新名称。
