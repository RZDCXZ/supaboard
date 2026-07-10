# SupaBoard

SupaBoard 是一个用于系统学习 Supabase 的多人协作任务板项目。项目以一条完整的业务链路串联 Supabase Database、Auth、RLS、Storage、Realtime、Edge Functions 与 Next.js SSR，重点关注可复现的本地开发流程和多租户安全边界。

> 当前进度：已完成阶段 7——任务纵向切片。邮箱 Auth、SSR 会话、Profile 和工作区能力保持可用；工作区成员可以创建、查看、筛选、分页、修改和删除任务，并查看受 RLS 保护的状态统计。任务约束、负责人校验、授权、统计 RPC/视图、Server Actions 和页面流程已由 pgTAP、Vitest 和 Playwright 覆盖。

## 目标能力

- 邮箱密码、GitHub OAuth、密码恢复与 Next.js SSR Cookie 会话。
- 工作区、成员、任务、评论和活动记录。
- 基于 Postgres RLS 的多租户数据隔离。
- 公共头像和私有任务附件。
- Postgres Changes、Presence 和 Broadcast 实时协作。
- Database Functions、触发器、迁移、Seed 与类型生成。
- Edge Function 特权操作及托管 Supabase 验收。

以上是项目规划能力，不代表当前阶段均已实现。具体进度以 [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) 为准。

## 技术栈

- Next.js 16、React 19、TypeScript
- Tailwind CSS 4
- shadcn/ui（Radix + Nova）与 Lucide 图标
- Supabase JavaScript Client 与 `@supabase/ssr`
- Zod
- Vitest、React Testing Library、Playwright、pgTAP
- ESLint、pnpm

依赖版本全部固定在 [`package.json`](./package.json) 和 [`pnpm-lock.yaml`](./pnpm-lock.yaml) 中。

## 环境要求

- Node.js 20.9 或更高版本
- pnpm 11
- Git
- Docker Desktop 或兼容 Docker Runtime（从阶段 3 开始用于本地 Supabase）

## 本地运行

安装依赖：

```bash
pnpm install
```

安装 Playwright 使用的 Chromium：

```bash
pnpm exec playwright install chromium
```

启动本地 Supabase：

```bash
pnpm exec supabase start
```

首次启动会下载 Docker 镜像。服务启动后，通过以下命令查看本地 Project URL 和 Publishable Key：

```bash
pnpm exec supabase status
```

复制环境变量模板，并将上述两个公开值写入 `.env.local`：

```bash
cp .env.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=本地 CLI 输出的 Publishable Key
```

不要将 Secret Key、Service Role Key 或其他本地凭据写入 Next.js 环境变量。默认本地服务可能对局域网可见，只应在可信网络中运行，禁止暴露到公网。

启动开发服务器：

```bash
pnpm dev
```

默认访问地址为 <http://localhost:3000>。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动 Next.js 开发服务器 |
| `pnpm build` | 创建生产构建 |
| `pnpm start` | 启动生产服务器 |
| `pnpm lint` | 运行 ESLint |
| `pnpm typecheck` | 运行 TypeScript 类型检查 |
| `pnpm test` | 运行 Vitest 单元测试 |
| `pnpm test:watch` | 以监听模式运行单元测试 |
| `pnpm test:e2e` | 启动开发服务器并运行 Playwright Chromium 测试 |
| `pnpm exec supabase start` | 启动本地 Supabase 服务 |
| `pnpm exec supabase status` | 查看本地服务地址和开发凭据 |
| `pnpm exec supabase db reset` | 从迁移和 Seed 重建本地数据库 |
| `pnpm exec supabase test db --local` | 运行本地 pgTAP 数据库测试 |
| `pnpm exec supabase gen types typescript --local > src/types/database.ts` | 重新生成数据库类型 |
| `pnpm exec supabase stop` | 停止本地 Supabase 服务 |

## 项目结构

```text
.
├── docs/                 # 产品、技术、页面与分步开发文档
├── public/               # 静态资源
├── src/app/              # Next.js App Router
├── src/components/       # shadcn/ui 基础组件、反馈组件与应用框架
├── src/features/auth/    # Auth 校验、Server Actions 与表单
├── src/features/tasks/   # 任务校验、查询、Server Actions、状态与界面
├── src/features/workspaces/ # 工作区校验、查询、Server Action 与组件
├── src/lib/supabase/     # Browser/Server Client 工厂与环境校验
├── src/types/            # 由本地数据库生成的 TypeScript 类型
├── supabase/             # 本地配置、迁移、Seed 与 pgTAP 测试
├── tests/e2e/            # Playwright 端到端测试
├── tests/unit/           # Vitest 单元测试
├── .env.example          # 可提交的环境变量模板
├── package.json          # 脚本与固定版本依赖
├── playwright.config.ts  # Playwright 测试目录与本地服务器配置
└── vitest.config.ts      # 单元测试配置
```

## 项目文档

- [`docs/PRD.md`](./docs/PRD.md)：产品目标、角色、功能需求和范围边界。
- [`docs/TECH.md`](./docs/TECH.md)：架构、数据模型、权限与测试策略。
- [`docs/DESIGN.md`](./docs/DESIGN.md)：页面结构、视觉规范和交互状态。
- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md)：16 个可独立验证的开发阶段。

## 开发与安全约定

- 每次只推进一个开发阶段，验证通过后再进入下一阶段。
- 数据库结构、策略、Storage 桶和 Realtime 配置统一通过迁移管理。
- 暴露 schema 中的业务表默认启用 RLS，并为授权行为编写测试。
- 浏览器只使用 Supabase 项目 URL 和 publishable key。
- secret/service key 不得进入 Next.js 公共环境变量、Git、文档或日志。
- 初始化和样板代码优先使用官方 CLI，避免手工维护不可复现的基础结构。

详细协作规则见 [`AGENTS.md`](./AGENTS.md)。
