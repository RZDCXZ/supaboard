# SupaBoard

SupaBoard 是一个用于系统学习 Supabase 的多人协作任务板项目。项目以一条完整的业务链路串联 Supabase Database、Auth、RLS、Storage、Realtime、Edge Functions 与 Next.js SSR，重点关注可复现的本地开发流程和多租户安全边界。

> 当前进度：已完成阶段 2——初始化 Next.js 与质量工具。业务页面、数据库结构和 Supabase 本地环境将在后续阶段逐步实现。

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

复制环境变量模板：

```bash
cp .env.example .env.local
```

阶段 3 初始化本地 Supabase 后，将 CLI 输出的项目 URL 和 publishable key 写入 `.env.local`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

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
| `pnpm test:e2e` | 预留 Playwright 端到端测试入口（尚未配置） |

## 项目结构

```text
.
├── docs/                 # 产品、技术、页面与分步开发文档
├── public/               # 静态资源
├── src/app/              # Next.js App Router
├── tests/unit/           # Vitest 单元测试
├── .env.example          # 可提交的环境变量模板
├── package.json          # 脚本与固定版本依赖
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
