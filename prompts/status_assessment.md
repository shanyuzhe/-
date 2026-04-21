# 总体状态评语 Prompt(DeepSeek deepseek-chat)

用途:给用户一句"过去若干周表现"的直白总结,贴学习规律、可执行。

---

## USER 模板

<since>
起始:{since_date}(覆盖 {days_covered} 天)
</since>

<overall>
总完成率:{overall_rate_pct}%
平均感受:{avg_feeling}/5
总任务数:{total_tasks}
</overall>

<weekly_trajectory>
{weekly_trajectory_text}
</weekly_trajectory>

<module_heatmap>
{module_heatmap_text}
</module_heatmap>

<recent_7d>
{recent_tasks_text}
</recent_7d>

<current_phase>
当前阶段:{phase_name}(Day {day_in_phase}/{phase_total_days})
重点模块:{phase_focus}
</current_phase>

---

请基于以上数据,给用户一段 **80-130 字** 的总体状态评语。

规则(严格遵守):

1. **必须点出一个具体事实**,不能全是抽象"继续加油":例如"高数 feeling 3.2 在所有模块里最低"或"最近 3 周完成率从 75% 掉到 45%"。
2. **给一个可执行建议**(一句话,含模块/时长/具体动作):例如"下周二/四把高数新题时长减半,错题占比提到 60%"。
3. **不吹捧不灌鸡汤**,语气像严格但温和的助理。
4. **不编造**:如果数据不支持某个判断,就说"目前数据不足以判断 X"。
5. **不要开头寒暄**("你好"/"让我看看"),直接给观察。
6. **assessment 字段内部必须是纯文本**,不要 markdown 列表,不要代码块,不要换行符。

输出格式(严格 JSON,仅一个字段):
```
{{"assessment": "覆盖 40 天里新鲜期完成率 80%,疲劳期掉到 45%,最近回升到 68%。高数 feeling 3.2 在所有模块里最低。建议下周把高数新题时长减半,错题占比提到 60%。"}}
```
