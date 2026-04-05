# HireMePlz Extension 全链路测试指南

## 前置条件

```bash
# 1. 启动 PostgreSQL（本地或 Docker）
# 确认 localhost:5432 可访问

# 2. 启动 Redis
brew install redis        # 如果没装
brew services start redis

# 3. 安装依赖 & 同步数据库
cd HireMePlz
npm install
cd backend && npx prisma db push

# 4. 配置 .env（项目根目录）
# 必须：
JWT_SECRET=dev-secret-key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hiremeplz?schema=public
REDIS_URL=redis://localhost:6379

# 可选（完整 LLM 测试需要）：
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL=gpt-4o-mini

# 5. 启动服务
cd backend && npm run dev          # 后端 :4000
cd frontend && npm run dev         # 前端 :3000
cd worker-llm && npm run dev       # LLM worker（需要 OpenAI key）
```

---

## Step 1: 登录（前端）

1. 打开 `http://localhost:3000/auth`
2. 使用已有测试账号登录：`cocolian8@gmail.com` / `cocolian`
3. 该账号已有完整的 Profile、Experience、Story 测试数据

> 也可以自己注册新账号，注册后需要手动填写 Profile / Experience / Story 数据

**验证：** 能看到 Dashboard 页面，左侧导航栏有 7 个链接（无 Answer Memory）

---

## Step 2: 检查 Profile

1. 点 **Profile**
2. 确认数据已填写（Full Name、Phone、Skills 等）
3. 点 **Edit** 可以修改，点 **Save** 保存

**验证：** 保存成功，切回 View 模式能看到所有数据

---

## Step 3: 添加 Education

1. Profile 页面 → Edit 模式 → Education 区域
2. 点 **+ Add Education**
3. 填写 School: `University of Toronto`, Degree: `MEng`, Field: `ECE`
4. 点 **Save**

**验证：** Education 记录出现在列表中，可以编辑和删除

---

## Step 4: 添加 Experience

1. 点 **Experiences** → **+ Add Experience**
2. 填写：

| 字段 | 示例值 |
|---|---|
| Title | Software Engineer Intern |
| Company | Tech Corp |
| Location | Toronto, ON |
| Description | Developed backend services using Node.js. Optimized API response times by 87%. |
| Highlights | Reduced API latency by 87%, Implemented Redis caching |
| Skills | Node.js, PostgreSQL, Redis |

3. 点 **Save**

**验证：** Experience 出现在列表中，Edit/Delete 按钮可用

---

## Step 5: 添加 Story

1. 点 **Story Library** → **+ Add Story**
2. 填写：

| 字段 | 示例值 |
|---|---|
| Title | Optimized API Response Time by 87% |
| Tags | performance, backend, leadership |
| Content | During my internship at Tech Corp, our legacy API had response times exceeding 3 seconds. I profiled the database queries, identified N+1 issues, and implemented batch loading with Redis caching. Response time dropped from 3.2s to 400ms — an 87% improvement. |

3. 点 **Save**

**验证：** Story 卡片显示 title、tags（灰色标签）、content 预览

---

## Step 6: 加载 Chrome Extension

1. 打开 `chrome://extensions/`，开启 **Developer mode**
2. 点 **Load unpacked**，选择 `HireMePlz/extension` 文件夹
3. 如果之前加载过，点刷新按钮

> 每次改了 extension 代码后需要先 `cd extension && npm run build`，再刷新扩展

**验证：** 扩展出现在列表中，图标正常显示

---

## Step 7: Extension Popup 登录

1. 点击 Chrome 工具栏的 HireMePlz 图标
2. 确认 API Server 是 `http://localhost:4000`，绿点显示 **Server connected**
3. 输入 Step 1 注册的邮箱和密码，点 **Sign In**

**验证：** 显示 "Logged in"，邮箱地址正确

---

## Step 8: 结构化字段自动填充

1. 打开一个 Greenhouse 申请页面（例：搜索 "site:boards.greenhouse.io apply"）
2. 等页面加载完成，右下角应出现 **HireMePlz** 浮窗按钮
3. 点击浮窗按钮，打开 Preview 面板

**验证（无 OpenAI key）：**
- First Name / Last Name / Email / Phone / LinkedIn 等字段应显示 ✓ 图标和正确的值
- SELECT 字段和开放式问题可能显示为空或 "No matching story found"

**验证（有 OpenAI key + worker-llm 在跑）：**
- 结构化字段同上
- SELECT 字段应自动选择最佳选项
- 开放式问题（textarea）应显示基于 Story 内容生成的回答，带 📖 图标和 "From: story标题 (xx%)"

---

## Step 9: Fill All

1. 在 Preview 面板中检查所有字段的值
2. 可以手动编辑预览中的值
3. 点 **Fill All**

**验证：**
- 表单字段被自动填入，填入的字段短暂高亮蓝色边框
- Panel 自动关闭
- 填入的值和 Preview 中一致

---

## Step 10: Token 自动同步（可选）

1. 在前端 `localhost:3000` 登录
2. 打开一个招聘网站页面

**验证：** 扩展自动从前端 localStorage 同步 token，无需在 popup 中手动登录

---

## 常见问题排查

| 症状 | 原因 | 解决 |
|---|---|---|
| 浮窗不出现 | URL 不匹配或页面无表单 | Console 看有无 `[HireMePlz]` 日志 |
| "Cannot reach server" | 后端没跑 | 启动后端 `cd backend && npm run dev` |
| 0 suggestions | Redis 没跑或 SELECT 字段卡住 LLM queue | `brew services start redis`；启动 worker-llm 或等后端加 fallback |
| 浮窗出现但无字段 | 表单在 iframe/Shadow DOM 中 | 检查 Console 日志看检测到几个 fields |
| Extension popup 登录失败 | API URL 不对 | 确认 popup 中 API Server 是 `http://localhost:4000` |
| Story 保存失败 | 数据库 schema 未同步 | `cd backend && npx prisma db push` |

---

## 已知问题

**SELECT 字段会阻塞整个 autofill 请求：** 当页面包含 SELECT 字段（如 Country）且规则匹配不到时，后端会将其发到 Redis queue 等待 worker-llm 处理。如果 worker-llm 没在跑（没有 OpenAI key），该 job 无人消费 → 超时 → 整个 `/api/autofill/suggestions` 请求卡死 → 包括能 regex 匹配到的结构化字段也返回不了。

**建议后端修复：** 给 LLM queue job 加短超时 fallback（如 5 秒），超时则跳过该字段，先返回已匹配的结构化字段结果。

---

## 测试覆盖总结

| 功能 | 需要 Redis | 需要 OpenAI key |
|---|---|---|
| 前端所有 CRUD（Profile/Experience/Story） | 否 | 否 |
| Extension 检测表单字段 | 否 | 否 |
| 结构化字段填充（姓名/邮箱等） | 是 | 否 |
| SELECT 字段 AI 选择 | 是 | 是 |
| 开放式问题 AI 回答 | 是 | 是 |
