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

**重要**:若 `<learning_plan>` 里有"任务生成必须遵守的原则"和"每天必须包含的 habit",**必须严格执行**,这是用户与 AI 共创的个性化要求,优先级高于默认规则。若包含"当前阶段推荐资源",任务的 `description` 里**优先引用这些具体资源**(例如 "顾家北听力 ep5"、"墨墨背单词 50 个")。

规则(严格遵守):
1. 覆盖今日预期时长的 80%-100%,留 20% 弹性
2. 每张 10-120 分钟,总和不超过 `{today_hours}` 小时
3. 优先修补**近 7 天跳过的任务**和**弱点排序靠前的模块**
4. 考虑当前时段精力(afternoon 适合输入型如听力阅读,evening 适合输出型如写作口语)
5. 若用户连续 3 天整体完成率 < 50%,**降量**到 3 张且总时长折半
6. 不得编造用户状态;若 `last_7_days` 为"暂无",按新手保守节奏
7. 只输出 JSON,不要任何额外文字或 markdown 代码块包裹

输出 JSON schema:
```
{{
  "tasks": [
    {{
      "module": "listening" | "speaking" | "reading" | "writing",
      "title": "简短标题(≤200 字)",
      "description": "具体做什么,含材料建议、目标数量(≤2000 字)",
      "estimated_minutes": 10-120 整数,
      "rationale_brief": "一句话为什么选这个(≤200 字)"
    }}
  ]
}}
```
