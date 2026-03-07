# HireMePlz

HireMePlz 是一个帮助求职者集中管理资料、智能填写申请表、记录申请历史并推荐岗位的项目。当前仓库按照 MVP 优先原则实现了四个核心子项目：

- `frontend`：Next.js Web 控制台
- `backend`：Express + Prisma API
- `extension`：Chrome 插件，负责识别页面字段并填充
- `worker`：后台职位抓取与匹配任务

## MVP 范围

当前优先保证以下链路可跑通：

1. 用户注册登录
2. 维护个人资料、经历和故事库
3. Chrome 插件扫描当前申请页面字段
4. 后端返回结构化字段建议和开放题建议
5. 用户确认后填入页面
6. 自动记录本次申请

## 快速开始

1. 复制环境变量模板：

```bash
cp .env.example .env
```

2. 安装依赖：

```bash
npm install
```

3. 生成 Prisma Client 并同步数据库：

```bash
npm run db:generate
npm run db:push
```

4. 分别启动服务：

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:worker
```

5. 构建插件：

```bash
npm run build --workspace extension
```

## Docker

开发环境也可以使用 Docker Compose：

```bash
docker compose up --build
```

## 模块说明

- `backend` 暴露认证、资料管理、故事库、申请记录、智能建议和岗位推荐 API
- `frontend` 提供管理后台页面
- `extension` 以内容脚本方式扫描表单并调用 API
- `worker` 支持职位抓取和匹配，可在无外部 API key 时回退到内置示例数据
