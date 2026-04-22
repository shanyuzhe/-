# 周度总结 Prompt(DeepSeek deepseek-reasoner)

用 `str.format(**context)` 填入变量。

---

## USER 模板

<user_profile>
考试日期:{exam_date}(距今 {days_left} 天)
目标分数/水平:{target_score}
当前阶段:{phase_name},重点 {phase_focus}
弱点排序:{weakness_rank}
</user_profile>

<this_week>
起止:{week_start} → {week_end}
总任务:{total_tasks}(完成 {done_tasks},跳过 {skipped_tasks},换掉 {swapped_tasks})
完成率:{completion_rate}
平均感受:{avg_feeling}/5
四模块时长占比:{module_distribution}
</this_week>

<this_week_tasks>
{tasks_text}
</this_week_tasks>

<last_week_summary>
{last_summary_text}
</last_week_summary>

请总结本周学习状态,并给下周 2-3 条具体建议。

规则:
1. `summary_text` 是**人话**(200 字内),描述真实状态,允许直白指出问题
2. `detected_patterns` 是观察到的规律,key-value 形式(如 `{{"evening_surge": true, "reading_neglect": true}}`)
3. `suggestions_text` 2-3 条**具体建议**(500 字内),不要空话套话
4. **严禁**编造数据;只基于提供的 `this_week_tasks`
5. 若完成率 < 50%,主要建议是"降量"而非"加油",帮助用户心理恢复
6. 只输出 JSON,不要任何额外文字

输出 JSON schema:
```
{{
  "summary_text": "200 字内人话",
  "detected_patterns": {{ "key": "value" }},
  "suggestions_text": "2-3 条下周建议"
}}
```
