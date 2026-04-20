# CCO 开发笔记 v0.1-plus-dialog

> 写于 2026-04-20 深夜,整理 v0.1 → v0.1 Plus → v0.1 Plus-dialog 的全貌、已知坑、维护清单、v0.2 方向。

---

## 一、当前状态速览

**版本**: `v0.1-plus-dialog`(包括 module 泛化 + 5 轮对话 prompt + 导入 UI + 时间线 + 复盘规则)

**Git 关键 tag**:
```
v0.1-day0          后端骨架
v0.1-day1          v0.1 前端完成
v0.1-plus          外部 AI 共创规划导入
v0.1-plus-overview 通用模板 + /plan 可视化时间线
v0.1-plus-dialog   module 泛化 + 5 轮对话 + 进度卡
```

**运行中服务**(如果这些还活着):
- 后端:`uvicorn app.main:app --host 127.0.0.1 --port 8000`(真实 DeepSeek 模式)
- 前端:`npm run dev`(Next.js 16 + Turbopack,`http://localhost:3000` · `http://192.168.31.14:3000`)

**当前数据库**:
- user.id=1, exam_date=2026-08-30, daily_hours=9.5(408 plan 生效)
- active plan_id=10(计算机 408,4 阶段)
- 基础重建的 start_date 被手动前移到 2026-04-20(原 04-21)让今天就生效

---

## 二、已知坑 & 对策(按被坑的痛度排序)

### 🔥 1. Next.js 16 跨域默认只允许 localhost

**现象**:手机访问 LAN IP 3000 → 页面能出,但点按钮没反应
**根因**:Next 16 默认 `allowedDevOrigins` 只有 localhost
**修**:`frontend/next.config.ts` 加 `allowedDevOrigins: ['192.168.31.14', ...]`
**后续**:以后换 WiFi(LAN IP 变)要同步改

### 🔥 2. Windows Clash 代理 hook 浏览器 127.0.0.1

**现象**:浏览器 POST /plan/import 不到后端(只有 OPTIONS 204)
**根因**:Clash 拦截浏览器 fetch 127.0.0.1
**修**:加 Next.js proxy 层 `frontend/app/api/proxy/[...path]/route.ts`
  - 浏览器 → `/api/proxy/plan/import` → Next 代理 → 后端
  - 浏览器不直接碰 127.0.0.1,绕开 Clash

### 🔥 3. Alembic autogenerate 对 CheckConstraint 识别不全

**现象**:migration 文件生成了但 upgrade() 是空 `pass`
**根因**:alembic 对 `__table_args__` 里 CheckConstraint 的变更 detect 不全
**修**:手动补 migration upgrade(`batch_alter_table.drop_constraint`)
**注意**:SQLite 必须 `render_as_batch=True` + constraint 必须有 name

### 🔥 4. DeepSeek R1 JSON mode 偶发 empty content

**现象**:R1 + `response_format=json_object` → content 为空
**根因**:R1 的 reasoning_content 耗光 max_tokens,final content 没空间
**修**:R1 专用 `json_mode=False` + prompt 要求 JSON + 后端 regex `{.*}` 兜底
**当前策略**:extraction 用 V3(快,稳);R1 保留给周度总结/深度校准(低频)

### 🔥 5. V3 固执保留原文英文 key(不中文化)

**现象**:prompt 明确要求 focus_modules 中文,V3 返回 `math_calculus / co / ds`
**根因**:V3 遵守"保留原文"优先于"按指令翻译"
**修**:后端 `_cn_module()` 做 fallback 映射字典(listening→听力 / math_calculus→高数 等 25+ key)
**新 key 怎么加**:编辑 `backend/app/llm.py::_MODULE_CN_MAP`

### 🔥 6. phase 表 orphan 残留

**现象**:`/today` 返回错的 phase(旧 plan 的"地基期"而不是新 plan 的"基础重建")
**根因**:`activate_plan` 只删 `plan_id IS NULL`,archived plan 的 phase 留在表里
**修 1**:`activate_plan` 改为删 `goal_id==goal.id` 全部 phase
**修 2**:today/progress 查 phase 防御性加 `plan_id==active_plan.id` filter

### 🔥 7. V3 给坏日期(如 "考试前")

**现象**:`end_date="考试前"` 导致 Phase 入库失败 + 前端时间线 NaN 宽度
**修 1**:`activate_plan` try/except 跳过坏日期(不入库)
**修 2**:前端 PlanOverview 过滤 `!isValidDate(end_date)` 的阶段

### 🔥 8. GeneratedTask.estimated_minutes 上限 120 阻挡真实学习

**现象**:V3 生成 150 分钟数学大块 → pydantic 拒 → 整次调用失败
**修**:放宽到 240(4 小时)+ prompt 同步改

---

## 三、核心架构一页纸

```
手机/浏览器(客户端)
    │
    ├─ GET /                     ← Server Component fetch 后端(Node 进程)
    ├─ POST /api/proxy/plan/...  ← 代理层(过 Clash)
    │           │
    ▼           ▼
Next.js 16(localhost:3000,允许 LAN + localhost)
    │
    ▼
FastAPI(127.0.0.1:8000)
    ├─ /today          V3 生成任务(~30s)
    ├─ /feedback       任务反馈入库
    ├─ /plan/import    V3 extraction(~90s,R1 不用)
    ├─ /plan/activate  激活 + 替换 phase + 同步 user.daily_hours
    └─ /progress       动态 module 占比(从 active plan 拿 keys)
    │
    ▼
SQLite(backend/cco.db)
    user · goal · phase · task · event · weekly_summary · learning_plan
```

---

## 四、维护常用命令

### 启动(冷启)
```powershell
# 后端
cd D:\雅思\项目\cco-assistant\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 前端(另一个 PowerShell)
cd D:\雅思\项目\cco-assistant\frontend
$env:NO_PROXY = "127.0.0.1,localhost"
npm run dev
```

### 停服务
```powershell
Get-NetTCPConnection -LocalPort 3000,8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### 切模型
```bash
# .env 里编辑:
MOCK_LLM=true           # 开发省 token
MOCK_LLM=false          # 真实调用(默认)
MODEL_FAST=deepseek-chat    # V3,任务生成/extraction
MODEL_DEEP=deepseek-reasoner # R1,周度总结用(慢)
```

### 切换学习目标(不想用 408,想换雅思/日语等)
1. 浏览器 `/onboarding` 粘贴新规划
2. 等 V3 extraction 90 秒
3. Step 3 点"采纳" → 自动 archive 旧 plan + 激活新 plan + 替换 phase + 同步 user.daily_hours

### DB 查询 cheat sheet
```python
import sqlite3
con = sqlite3.connect(r'D:/雅思/项目/cco-assistant/backend/cco.db')

# 当前 active plan
con.execute("SELECT id, subject, daily_hours FROM learning_plan WHERE status='active'").fetchall()

# 今日任务
con.execute("SELECT id, module, title, status, feeling FROM task WHERE date=date('now')").fetchall()

# 归档旧 plan
con.execute("UPDATE learning_plan SET status='archived' WHERE id=?", (old_id,))
```

---

## 五、v0.2 清单(按价值排序)

### 🎯 必做(v0.2 核心)
1. **Web search 接入**(Tavily/Serper + function calling):让 V3 查真实资源,不靠用户粘贴
2. **多用户 + 极简认证**(JWT / token):支持 10-20 人测试的前提
3. **部署**(腾讯云轻量 ¥50/月 + nginx)
4. **完成按钮 UX 优化**:任务完成后的"感觉"打分应该更直观(swipe? 颜色?)

### 💡 强烈推荐(v0.2 或 v0.3)
5. **Plan 在线编辑**:目前只能重新导入覆盖,可以做字段级编辑(改阶段日期 / 加 habit)
6. **连续 3 天未打开提醒**:邮件 / 微信通知 / 桌面通知
7. **周度总结自动跑**(目前写了接口但没定时触发,需要 APScheduler)
8. **错题本**:feeling=1-2 的 task 自动归档到"需要复盘"集合,/plan 页显示

### 🧊 可押后
9. LLM 自动阶段切分(替代"手动改日期")
10. 雅思/编程的口语录音 / 代码执行反馈
11. 任务卡"分享到微信/小红书"(社交裂变)

---

## 六、今晚最后状态验证

- [✓] /today 能真实调 V3 生成 408 中文 module 任务(约 30 秒)
- [✓] /plan 页时间线正常显示 4 阶段(考前收尾因坏日期自动跳过)
- [✓] /progress 动态 21 个 408 模块分布
- [✓] /onboarding 5 轮对话 prompt + 导入流程闭环
- [✓] 手机 LAN 访问 + Client 按钮正常工作(allowedDevOrigins + proxy)
- [✓] V3 针对性复盘规则已验证(feeling≤2 半量 + skipped 低启动)
- [✓] user.daily_hours=9.5 同步 + activate_plan 自动同步机制

## 七、明早该做的第一件事

1. F5 手机 `http://192.168.31.14:3000`
2. 看今日任务列表应该有 8 张左右,含 2 张复盘任务(因为昨天的假历史数据)
3. **清掉假历史数据**(如果不想看到):
   ```sql
   DELETE FROM task WHERE date='2026-04-19' AND seq IN (100, 101);
   ```
4. 点几个任务"完成",填真实感受,看 V3 能否根据你**真实的**反馈调整明天的任务

---

_v0.1-plus-dialog 至此收工。commit `93bfb70`_
