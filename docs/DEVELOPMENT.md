# SupaBoard 分步开发指南

| 项目 | 内容 |
| --- | --- |
| 文档版本 | 1.0 |
| 文档状态 | 可执行 |
| 产品需求 | [`docs/PRD.md`](./PRD.md) |
| 技术设计 | [`docs/TECH.md`](./TECH.md) |
| 页面设计 | [`docs/DESIGN.md`](./DESIGN.md) |
| 开发方式 | 安全纵向切片、逐阶段验证、本地优先 |

## 1. 如何使用本文档

本文档把 SupaBoard 拆成 16 个可独立检查的开发阶段。每个阶段都应形成一个可以运行、可以验证、可以回退的检查点，不要同时展开多个阶段。

每个阶段按以下循环执行：

1. 阅读“目标”“Supabase 知识点”和关联需求。
2. 只修改“关键文件”范围内的文件。
3. 按顺序完成开发步骤，不提前实现后续能力。
4. 运行全部验证命令，确认结果符合预期。
5. 回答学习复盘问题，确保理解安全边界和数据流。
6. 创建一个聚焦提交，再进入下一阶段。

当某个验证失败时，停止叠加新功能。先保留失败输出，确认是代码问题、迁移问题、权限问题还是环境问题，再修复当前阶段。

本文档刻意不提供整段可复制的完整实现。关键文件、职责、命令、验证方法和完成条件已经明确，具体代码由开发者依据 [`docs/TECH.md`](./TECH.md) 编写，以保留学习和调试过程。

## 2. 全程约定

### 2.1 前置环境

- Node.js 20 或更高版本。
- pnpm，并提交 `pnpm-lock.yaml`。
- Docker Desktop 或兼容 Docker Runtime，用于本地 Supabase。
- Git；每个阶段开始前工作区应无意外改动。
- 两个可同时运行的浏览器上下文，用于后续 Realtime 验证。

首次检查：

```bash
node --version
pnpm --version
docker version
git status --short
```

预期结果：命令均成功；Node.js 主版本不低于 20；Git 输出只包含当前已知改动。

### 2.2 版本门槛

Supabase、Next.js 和 `@supabase/ssr` 会持续变化。开始开发以及进入 Auth、Realtime、Edge Function、云端验收阶段前，都要执行：

```bash
pnpm exec supabase --version
pnpm exec supabase --help
```

同时检查：

- [Supabase Changelog](https://supabase.com/changelog)。
- [Data API 显式授权变更说明](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)。
- [Next.js + Supabase](https://supabase.com/nextjs)。
- 当前阶段对应的 Supabase 官方文档。

特别注意：新 Supabase 项目可能不会自动把 `public` 表暴露给 Data API。迁移必须显式向所需角色执行 `GRANT`，同时启用 RLS 并创建业务 policy。`GRANT` 决定角色能否访问表，RLS 决定角色能访问哪些行，两者不能互相替代。

CLI 命令的实际参数始终先通过对应 `--help` 确认。迁移文件始终通过 `supabase migration new` 创建，不手写时间戳文件名。

### 2.3 安全红线

- 浏览器只允许接触项目 URL 和 publishable key。
- secret/service key 只允许存在于 Edge Function 环境，不能使用 `NEXT_PUBLIC_` 前缀。
- 不在 Git、文档、日志、截图和测试输出中保存真实 token 或凭据。
- 授权只依赖数据库成员关系，不使用用户可修改的 `user_metadata`。
- 暴露 schema 中的业务表必须启用 RLS；UPDATE policy 同时定义 `USING` 和 `WITH CHECK`。
- `SECURITY DEFINER` 只用于技术设计中明确列出的内部函数，固定 `search_path` 并撤销 `PUBLIC` 执行权限。
- 每个数据阶段至少验证 Owner、成员和非成员三个身份。

### 2.4 数据库阶段统一流程

从阶段 4 开始，凡是涉及数据库结构或权限，都使用同一流程：

1. 用 `pnpm exec supabase migration new workspaces` 这类与当前阶段对应的明确名称创建迁移；具体阶段使用该阶段“开发步骤”给出的名称。
2. 在迁移中同时编写结构、约束、索引、`GRANT`、RLS 和 policy。
3. 为合法访问与越权访问编写 pgTAP 测试。
4. 执行数据库重置和测试。
5. 重新生成 TypeScript 类型，不手工编辑生成文件。
6. 实现查询、Server Action 和页面。
7. 运行单元测试、类型检查和相关浏览器验证。

统一验证命令：

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm exec supabase gen types typescript --local > src/types/database.ts
pnpm lint
pnpm exec tsc --noEmit
pnpm test
```

预期结果：数据库可从空状态重建；pgTAP、类型检查和单元测试均通过；类型文件的变化能由当前迁移解释。

### 2.5 阶段总览

| 阶段 | 可交付检查点 | 核心知识 |
| --- | --- | --- |
| 1 | 开发约定与需求映射明确 | 安全边界、测试策略 |
| 2 | 空 Next.js 应用可检查和测试 | App Router、工具链 |
| 3 | 本地 Supabase 可重置并生成类型 | CLI、migration、seed、typegen |
| 4 | 完整邮箱 Auth 和 profile 流程可用 | Auth、SSR Cookie、PKCE、trigger |
| 5 | Auth 页面和受保护应用框架符合设计 | Server/Client Component 边界 |
| 6 | 用户可创建并查看自己的工作区 | Data API、RPC、RLS |
| 7 | 工作区成员可维护任务 | CRUD、约束、分页、统计 |
| 8 | 评论和活动记录可用 | 复合外键、trigger、只读日志 |
| 9 | 成员列表和三身份测试夹具稳定 | 多租户测试、成员关系 |
| 10 | 公共头像上传和替换可用 | 公共 bucket、upsert policy |
| 11 | 私有附件上传和下载可用 | 私有 bucket、signed URL、补偿 |
| 12 | 任务和评论跨窗口实时同步 | Postgres Changes、reducer |
| 13 | 在线成员和输入状态安全可用 | Presence、Broadcast、Realtime RLS |
| 14 | Owner 可按邮箱管理成员 | Edge Function、用户 JWT、secret key |
| 15 | 本地主流程和权限矩阵全部通过 | pgTAP、Vitest、Playwright |
| 16 | 本地应用连接托管 Supabase 通过验收 | link、deploy、OAuth、advisors |

## 3. 阶段 1：确认需求与开发约定

### 目标

在写代码前建立需求、架构、设计、安全和测试的共同基线，避免开发过程中临时改变数据模型或权限模型。

### Supabase 知识点与关联需求

- 知识点：Auth 身份与业务授权的区别、RLS 是数据库安全边界、迁移是唯一 schema 来源。
- 关联范围：`PRD.md` 全部需求、`TECH.md` 第 1～3、14、18 节、`DESIGN.md` 第 1、10、14 节。

### 关键文件

- 阅读：`docs/PRD.md`、`docs/TECH.md`、`docs/DESIGN.md`、`docs/DEVELOPMENT.md`。
- 本阶段不创建业务代码。

### 开发步骤

1. 按 PRD 顺序阅读角色、路由、功能编号和明确不做项。
2. 对照 TECH 确认浏览器、Next.js 服务端、Edge Function 三条访问路径使用的凭据和 RLS 行为。
3. 对照 DESIGN 确认 8 个路由、应用框架和 Owner 专属操作。
4. 建立个人学习记录，至少记录每阶段遇到的一个错误、原因和修复方式；学习记录可放在 Git 忽略的本地笔记中。
5. 约定一个阶段只产生一个主要能力，阶段验证通过后再提交。

### 验证命令与预期结果

```bash
rg -n '^#### (AUTH|PROFILE|WORKSPACE|MEMBER|TASK|COMMENT|ACTIVITY|STORAGE|REALTIME|EDGE)-' docs/PRD.md
rg -n '^## ' docs/TECH.md docs/DESIGN.md
git status --short
```

预期结果：能够列出全部功能编号和设计章节；工作区没有无法解释的文件变化。

### 完成条件

- 能解释“已登录不等于已授权”。
- 能指出 secret key 唯一允许出现的位置。
- 能说明为什么 schema、bucket 和 policy 都必须来自迁移。

### 常见问题

- 把前端隐藏按钮当成授权：按钮只影响体验，RLS 和服务端检查才负责安全。
- 为了快速开始跳过测试角色：后续很难证明跨租户访问是否被拒绝。

### 学习复盘

- Browser Client、Server Supabase Client 和 Edge Function 管理员客户端分别信任什么？
- 如果移除前端权限判断，数据库是否仍能拒绝越权请求？

### 建议提交点

本阶段通常不提交；如果补充了协作约定，只提交文档变化。

## 4. 阶段 2：初始化 Next.js 与质量工具

### 目标

得到一个最小、可运行、可类型检查、可单元测试的 Next.js App Router 项目，不实现业务页面。

### Supabase 知识点与关联需求

- 知识点：为后续 SSR 和 Browser Client 建立明确的运行时边界。
- 关联范围：TECH 第 2、4 节；DESIGN 的实现基础。

### 关键文件

- 创建或生成：`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`next.config.*`、`tsconfig.json`、`src/app/`。
- 创建：`vitest.config.ts`、`tests/unit/setup.ts`、`.env.example`、`.gitignore`。
- 修改：`package.json` scripts。

### 开发步骤

1. 由于项目根目录已有需要保留的 `AGENTS.md`，先在临时目录运行 `pnpm create next-app@latest /private/tmp/supaboard-next-scaffold --yes --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --disable-git --no-agents-md`，再将生成的应用和配置文件合并到项目根目录；不复制临时目录的 `node_modules`，不覆盖 `docs/` 和 `AGENTS.md`。
2. 使用 `pnpm add --save-exact @supabase/supabase-js @supabase/ssr zod` 安装运行依赖。
3. 使用 `pnpm add -D --save-exact supabase vitest jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @vitejs/plugin-react @playwright/test` 安装开发依赖；当前 Vite 已原生支持 TypeScript 路径映射，不再安装会产生弃用提示的 `vite-tsconfig-paths`。
4. 为 `package.json` 增加 `test`、`test:watch`、`typecheck` 和 `test:e2e` scripts。
5. 配置 Vitest 使用 React 插件、`resolve.tsconfigPaths: true`、`jsdom` 和测试 setup；只写一个验证测试环境可运行的 smoke test。
6. `.env.example` 只声明 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`，不填写真实值。
7. 保留 Next.js 默认首页作为临时 smoke 页面，不提前实现 DESIGN 中的应用界面。

### 验证命令与预期结果

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

预期结果：四条命令退出码均为 0；单元测试至少有 1 个通过；构建产物中没有 Supabase secret/service key。

### 完成条件

- 锁文件已生成，依赖版本可复现。
- lint、类型检查、测试和构建都有稳定入口。
- 还没有业务数据库代码或假 Supabase 数据。

### 常见问题

- 用全局 Supabase CLI：项目级固定版本更容易复现。
- 把测试、类型检查留到功能完成后：后续无法确定错误由哪个阶段引入。

### 学习复盘

- Next.js 中哪些代码一定运行在服务端，哪些代码会进入浏览器包？
- 为什么 publishable key 可以暴露，而 secret key 不可以？

### 建议提交点

```bash
git add package.json pnpm-lock.yaml src tests vitest.config.ts tsconfig.json .env.example .gitignore
git commit -m "chore: initialize nextjs project"
```

## 5. 阶段 3：建立本地 Supabase 基线

### 目标

本地 Supabase 可以启动、停止和从迁移重建；Next.js 可以分别创建 Browser Client 和 Server Client；数据库类型可以重复生成。

### Supabase 知识点与关联需求

- 知识点：CLI、本地 Docker 栈、`config.toml`、migration、seed、publishable key、typegen。
- 关联范围：PRD 学习阶段 1；TECH 第 4、5 节。

### 关键文件

- 创建：`supabase/config.toml`、`supabase/migrations/`、`supabase/seed.sql`。
- 创建：`src/lib/supabase/client.ts`、`src/lib/supabase/server.ts`、`src/types/database.ts`。
- 创建本地文件：`.env.local`，该文件必须被 Git 忽略。

### 开发步骤

1. 运行 `pnpm exec supabase init`，确认生成本地配置。
2. 运行 `pnpm exec supabase start`，记录命令输出中的本地 API URL 和 publishable key；不要复制 secret/service key 到 Next.js。
3. 将项目 URL 和 publishable key 写入 `.env.local`，变量名与 `.env.example` 一致。
4. 运行 `pnpm exec supabase migration new baseline`，在首个迁移中只建立后续需要的 `private` schema 和必要扩展，不提前创建业务表。
5. 在 `seed.sql` 中仅保留说明和幂等约定，不写真实凭据。
6. 创建 Browser Client 工厂，使用 `createBrowserClient`；创建 Server Client 工厂，通过 Next.js cookies adapter 读写 Cookie。
7. 运行本地类型生成，确保即使业务 schema 为空也能生成合法 TypeScript 文件。
8. 为环境变量缺失编写单元测试，错误文案只指出缺失变量名，不回显值。

### 验证命令与预期结果

```bash
pnpm exec supabase status
pnpm exec supabase db reset
pnpm exec supabase gen types typescript --local > src/types/database.ts
pnpm typecheck
pnpm test
git status --short
```

预期结果：本地服务状态正常；数据库重置成功；类型文件生成；`.env.local` 不出现在 Git 状态中。

### 完成条件

- 删除本地数据库状态后仍可通过迁移和 Seed 重建。
- Browser/Server Client 创建逻辑集中，不在业务组件中重复配置。
- Git 中不存在任何真实 key、token 或密码。

### 常见问题

- 直接在 Studio 建表：重置后会丢失，且无法审查迁移历史。
- 将 secret key 误写为 `NEXT_PUBLIC_`：该值会进入浏览器构建产物。
- 手工编辑 `database.ts`：下次 typegen 会覆盖手工内容。

### 学习复盘

- `supabase start` 启动了哪些本地服务？
- migration、seed 和 typegen 分别解决什么问题？

### 建议提交点

```bash
git add supabase src/lib/supabase src/types/database.ts .env.example
git commit -m "chore: add local supabase baseline"
```

## 6. 阶段 4：完成 Auth、SSR 会话与 Profile

> 实施状态（2026-07-07）：已完成。邮箱确认与密码恢复通过本地 Mailpit 验证；Profile trigger、GRANT 和 RLS 通过 pgTAP 验证；SSR 会话刷新、登录、登出和受保护路由通过 Playwright 验证。GitHub OAuth 入口已实现，Provider 凭据和云端回调将在阶段 16 配置并验收。

### 目标

完成邮箱注册、邮箱确认、登录、刷新保持会话、密码恢复、更新密码、登出和受保护路由，并由数据库自动创建 profile。

### Supabase 知识点与关联需求

- 知识点：Supabase Auth、PKCE、SSR Cookie、会话刷新、Auth trigger、profile RLS。
- 关联需求：AUTH-01～AUTH-05、PROFILE-01；TECH 第 6.1、7.5、8、9 节。

### 关键文件

- 创建迁移：profile 表、Auth trigger、授权和 RLS。
- 创建：`src/proxy.ts`、`src/app/auth/callback/route.ts`。
- 创建：`src/features/auth/`、`src/features/profiles/`、对应 validation 和 actions。
- 创建页面：`src/app/(auth)/login/`、`signup/`、`forgot-password/`、`update-password/`。
- 测试：`supabase/tests/database/profiles.test.sql`、Auth validation 单元测试、Auth Playwright 测试。

### 开发步骤

1. 创建 `profiles` 迁移，包含字段约束、时间字段、显式 `GRANT`、RLS 和“已登录可读、仅本人可更新”的 policy。
2. 在 `private` schema 创建 `handle_new_user()`；固定空 `search_path`、全限定对象名、撤销 `PUBLIC` 执行权限，并建立 `auth.users` INSERT trigger。
3. 编写 pgTAP：新用户生成 profile、用户只能修改自己的 profile、匿名用户不可访问。
4. 实现 `/login`、`/signup`、`/forgot-password`、`/update-password` 对应的登录、注册、密码恢复、更新密码和登出 actions；所有输入先经过 Zod。
5. 实现 callback Route Handler，校验 `next` 只能是站内相对路径，再进行 PKCE code exchange。
6. 实现 Cookie 刷新层；未登录访问 `/app/**` 时重定向 `/login`，但不把该层当成业务授权边界。
7. 在本地 Mailpit 完成注册确认和密码恢复验证。
8. 编写 Playwright Auth 流程，覆盖刷新保持会话、登出后拒绝受保护路由和无效恢复链接。

### 验证命令与预期结果

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm exec supabase gen types typescript --local > src/types/database.ts
pnpm test
pnpm exec playwright test tests/e2e/auth.spec.ts
pnpm typecheck
```

预期结果：数据库和应用测试通过；确认邮件经 callback 后进入 `/app`；刷新保持登录；退出后再次访问 `/app` 被重定向。

### 完成条件

- PROFILE-01 和 AUTH-01～05 都有可重复验证路径。
- 页面或日志不暴露 access token、refresh token、Authorization 或原始 Auth 错误。
- 授权不读取 `user_metadata`。

### 常见问题

- 只读取本地 session 判断用户：服务端应使用当前官方推荐的已验证用户或 claims 方法。
- callback 接受任意 `next`：会形成开放重定向风险。
- 触发器失败导致注册失败：优先查看本地 Auth 和 Postgres 日志，再检查函数权限与 `search_path`。

### 学习复盘

- PKCE callback 为什么必须在服务端交换 code？
- Cookie 刷新层和 RLS 分别阻止什么类型的问题？

### 建议提交点

```bash
git add supabase src/proxy.ts src/app src/features/auth src/features/profiles tests/e2e/auth.spec.ts
git commit -m "feat: add auth and profile flow"
```

## 7. 阶段 5：实现视觉基础与应用框架

> 实施状态（2026-07-08）：已完成。已使用官方 shadcn CLI 的 Radix + Nova 配置建立语义视觉 token 和通用组件；Auth 页面保留阶段 4 的真实流程并补齐字段错误关联、密码显隐和加载播报；受保护应用框架、响应式覆盖导航、工作区空状态和最小设置页已由 Vitest 与 Playwright 验证。工作区创建与查询仍留在阶段 6。

### 目标

把 DESIGN 中的颜色、排版、通用反馈、Auth 布局和登录后边栏落实为可复用组件，不接入尚未实现的工作区业务。

### Supabase 知识点与关联需求

- 知识点：Server Component 获取首屏用户、Client Component 处理交互，避免把无关逻辑都放到客户端。
- 关联范围：DESIGN 第 3～5、9、11～13 节。

### 关键文件

- 修改：`src/app/globals.css`、根 layout、Auth 页面。
- 创建：`src/components/ui/`、`src/components/feedback/`、`src/components/app-shell/`。
- 创建：`src/app/app/layout.tsx`、`src/app/app/page.tsx` 的空状态。
- 测试：通用组件单元测试和基础可访问性断言。

### 开发步骤

1. 将 DESIGN 色彩、字体、4px 间距、圆角和焦点环定义为 CSS 自定义属性。
2. 实现 Button、Input、Textarea、Select、Badge、Avatar、Card、Dialog、Drawer、Toast、Skeleton 和 InlineAlert 的最小状态集合。
3. 让 Auth 页面使用统一 `400px` 卡片布局，保留阶段 4 的真实表单行为。
4. 实现 `240px` 桌面边栏、页面标题区和响应式覆盖式导航；工作区列表先显示真实空状态，不写假数据。
5. 处理键盘焦点、Dialog/Drawer 焦点锁定、错误字段关联和加载播报。
6. 用组件测试验证 disabled、loading、error 和键盘操作。

### 验证命令与预期结果

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

预期结果：检查全部通过；Auth 功能未回归；未登录不能看到应用框架；键盘可操作表单和弹窗。

### 完成条件

- 视觉值来自 DESIGN，不在业务页面重复定义颜色和间距。
- 通用组件只包含当前产品需要的状态，不建设独立设计系统。
- `/app` 有合法空状态，但还没有工作区 CRUD。

### 常见问题

- 过早抽象大型组件库：只提取已重复使用的组件。
- 把服务端读取用户的 layout 变成全客户端组件：会增加加载闪烁和会话复杂度。

### 学习复盘

- 哪些组件必须使用 `'use client'`，哪些可以保留为 Server Component？
- 为什么视觉禁用状态必须同时设置原生 `disabled`？

### 建议提交点

```bash
git add src/app src/components
git commit -m "feat: add application design foundation"
```

## 8. 阶段 6：工作区创建与列表

### 目标

用户能够创建工作区、自动成为唯一 Owner，并且只能看到自己加入的工作区。

### Supabase 知识点与关联需求

- 知识点：关系模型、事务 RPC、成员辅助函数、显式授权、RLS、Server Action。
- 关联需求：WORKSPACE-01、WORKSPACE-02；TECH 第 6.2、6.3、7.1、7.2、8、10 节。

### 关键文件

- 创建迁移：`workspaces`、`workspace_members`、索引、Owner 约束、成员辅助函数、`create_workspace` RPC、授权和 RLS。
- 创建：`src/features/workspaces/` 的 validation、queries、actions 和 components。
- 修改：`src/app/app/page.tsx`、应用边栏。
- 测试：工作区 pgTAP、validation/action 单元测试、工作区 Playwright 测试。

### 开发步骤

1. 用 CLI 创建工作区迁移，按 TECH 建立两个表、复合主键、部分唯一索引、外键和 Owner 保护触发器。
2. 在 `private` schema 实现 `is_workspace_member()` 和 `is_workspace_owner()`；函数只接受工作区 ID，不接受用户 ID。
3. 实现 `create_workspace(name)`，从 `auth.uid()` 获取 Owner，并在同一事务创建工作区和 Owner 成员关系。
4. 对表、序列和函数执行最小显式 `GRANT`；启用 RLS，并为 SELECT、INSERT、UPDATE、DELETE 编写与角色相符的 policy。
5. 编写 Alice、Bob、Charlie 的 pgTAP 场景，验证成员可见性、Owner 唯一性、普通成员不能管理工作区、Charlie 猜 UUID 也读不到数据。
6. 生成类型后实现 Zod 名称校验、创建工作区 action 和当前用户工作区查询。
7. 实现 `/app` 工作区列表、空状态、错误状态和创建弹窗；成功后进入新工作区。
8. 将真实工作区列表接入边栏，名称过长时按 DESIGN 截断。

### 验证命令与预期结果

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm exec supabase gen types typescript --local > src/types/database.ts
pnpm test
pnpm exec playwright test tests/e2e/workspaces.spec.ts
pnpm typecheck
```

预期结果：Alice 只能看到自己加入的工作区；创建工作区后 Owner 关系自动存在；Bob 和 Charlie 不能修改 Alice 的工作区。

### 完成条件

- 创建流程不接受客户端提交的 `owner_id`。
- 数据库约束保证每个工作区恰好一个 Owner，Owner 不能通过普通成员操作删除自己。
- 列表、边栏和空状态都使用真实查询结果。

### 常见问题

- RLS policy 相互查询造成递归：成员判断通过受控的 `private` 辅助函数解决。
- 只创建 policy 忘记 `GRANT`：Data API 会返回表权限错误，而不是行级拒绝。
- 分两次从客户端创建工作区和成员：第二次失败会产生无 Owner 工作区，应使用 RPC 事务。

### 学习复盘

- 为什么 `create_workspace` 不接受 Owner ID？
- `GRANT`、RLS policy 和数据库约束分别保护什么？

### 建议提交点

```bash
git add supabase src/features/workspaces src/app/app
git commit -m "feat: add workspace creation and listing"
```

> 实施状态（2026-07-09）：已完成。已新增 `workspaces`、`workspace_members`、Owner 唯一约束、Owner 保护触发器、成员辅助函数和 `create_workspace` RPC；迁移显式配置 `GRANT` 与 RLS。`/app`、应用边栏和最小工作区详情页已接入真实查询；创建工作区后当前用户自动成为唯一 Owner 并跳转到工作区页。阶段 7 的任务 CRUD、统计和成员管理仍未实现。

## 9. 阶段 7：任务纵向切片

### 目标

工作区成员能够创建、查看、筛选、分页、修改和删除任务，并查看受 RLS 保护的状态统计。

### Supabase 知识点与关联需求

- 知识点：Data API CRUD、复合约束、assignment trigger、索引、RPC、security-invoker view、分页。
- 关联需求：TASK-01～TASK-04；TECH 第 6.4、6.8、7.3、7.4、8、10 节。

### 关键文件

- 创建迁移：`tasks`、负责人检查 trigger、索引、`get_workspace_stats`、`workspace_task_stats`、授权和 RLS。
- 创建：`src/features/tasks/` 的 schema、queries、actions、task reducer、列表、筛选、分页、弹窗和抽屉。
- 修改：工作区页面和路由查询参数解析。
- 测试：任务 pgTAP、Zod/action/reducer 单元测试、任务 Playwright 测试。

### 开发步骤

1. 建立 `tasks` 表及 TECH 中全部字段、长度、状态、优先级、外键和不可重绑约束。
2. 创建负责人检查 trigger，拒绝把任务分配给工作区外用户。
3. 建立工作区默认列表、状态筛选和负责人筛选索引。
4. 实现 `get_workspace_stats()` 和 `security_invoker` 统计视图，显式授权并确保底层任务 RLS 生效。
5. 启用 tasks RLS：成员可读写；创建者来自当前用户；更新不能修改 workspace 或 creator；非成员无权访问。
6. 编写 Owner、成员、非成员以及非法负责人的 pgTAP 测试，特别检查 UPDATE 未改变受保护字段。
7. 生成类型，实现任务 validation、查询、Server Actions 和稳定的 `ActionResult` 错误映射。
8. 实现统计卡片、状态/负责人筛选、每页 20 条分页和按状态分组列表。
9. 实现创建弹窗和详情抽屉中的标题、描述、状态、优先级、负责人编辑。
10. 删除任务时先只处理数据库记录；附件对象清理在阶段 11 接入，当前 UI 不提供带附件任务的完整删除承诺。

### 验证命令与预期结果

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm exec supabase gen types typescript --local > src/types/database.ts
pnpm test
pnpm exec playwright test tests/e2e/tasks.spec.ts
pnpm typecheck
```

预期结果：合法成员可以完成任务 CRUD；Charlie 无法读取或猜测任务；筛选、分页、统计和任务列表一致；工作区外用户不能成为负责人。

### 完成条件

- TASK-01～04 均有数据库和浏览器验证。
- Server Action 不接受 `created_by`，而是从会话读取当前用户。
- 分页最大值在服务端限制为 100，不只依赖 UI。

### 常见问题

- UPDATE 返回零行：先检查 SELECT policy，再检查 UPDATE 的 `USING` 和 `WITH CHECK`。
- 统计视图绕过 RLS：视图必须使用 `security_invoker = true`。
- 页面直接使用数据库错误：应映射为稳定业务 code 和用户文案。

### 学习复盘

- 为什么负责人校验更适合数据库 trigger，而不只放在下拉框？
- `.range()` 分页和对应索引如何配合？

### 建议提交点

```bash
git add supabase src/features/tasks src/app/app/workspaces tests
git commit -m "feat: add task management slice"
```

> 实施状态（2026-07-10）：已完成。已新增 `tasks` 表、字段约束、不可重绑与负责人校验 trigger、列表/筛选索引、`get_workspace_stats` RPC、`security_invoker` 统计视图、显式 `GRANT` 和成员 RLS。工作区详情页已接入任务统计、状态/负责人筛选、每页 20 条分页、状态分组、创建弹窗和详情抽屉；任务输入、查询、Server Actions、reducer、三身份权限及浏览器 CRUD 流程均已覆盖。评论、附件、活动、成员管理和 Realtime 仍按后续阶段实现。

## 10. 阶段 8：评论与活动记录

### 目标

成员可以在任务中发表评论；任务新增、状态变化和删除自动形成不可由客户端篡改的活动记录。

### Supabase 知识点与关联需求

- 知识点：复合外键、多租户冗余键、触发器、只读表、数据库生成审计记录。
- 关联需求：COMMENT-01、ACTIVITY-01；TECH 第 6.5、6.7、7.6、8 节。

### 关键文件

- 创建迁移：`comments`、`activity_logs`、复合外键、索引、activity trigger、授权和 RLS。
- 创建：`src/features/comments/`、`src/features/activity/`。
- 修改：任务抽屉评论区、工作区活动页签。
- 测试：comments/activity pgTAP、评论 validation/action 单元测试、浏览器测试。

### 开发步骤

1. 建立 comments 复合外键，确保 `task_id` 和 `workspace_id` 必须属于同一个任务。
2. 建立 activity_logs 表；客户端只授予 SELECT，不授予 INSERT、UPDATE、DELETE。
3. 在 `private` schema 创建任务活动 trigger function，固定 `search_path`，在 INSERT、状态变化和 DELETE 时写日志。
4. 为 comments 建立成员读取/新增、作者更新、作者或 Owner 删除的 policy；为 activity_logs 建立成员只读 policy。
5. 编写跨工作区评论、非法作者、Bob 删除 Alice 评论、Owner 删除任意评论、客户端伪造活动记录等 pgTAP 测试。
6. 实现评论 body 的 trim、1～2000 字符校验和错误映射。
7. 实现任务抽屉评论列表与提交表单；根据作者或 Owner 显示删除入口。
8. 实现活动页签，按时间倒序展示任务创建、状态变化和删除；actor 为空时显示“系统”。

### 验证命令与预期结果

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm exec supabase gen types typescript --local > src/types/database.ts
pnpm test
pnpm exec playwright test tests/e2e/comments-activity.spec.ts
pnpm typecheck
```

预期结果：成员评论可用；评论权限符合作者/Owner 规则；客户端不能直接写活动表；状态改变只产生一次正确日志。

### 完成条件

- COMMENT-01、ACTIVITY-01 的合法与越权路径均有测试。
- 删除任务后活动日志保留任务 ID 和必要 metadata，不依赖已删除任务外键。
- 页面不提供活动记录编辑入口。

### 常见问题

- 只用 task ID 建评论外键：可能把 workspace_id 写成另一个租户，破坏 RLS 过滤假设。
- trigger 使用不安全 `search_path`：攻击者可能劫持未限定对象名。
- UPDATE 每次都写状态日志：trigger 必须只响应状态实际变化。

### 学习复盘

- 为什么 comments 同时保存 task_id 和 workspace_id？
- 活动记录为什么应由数据库 trigger 而不是浏览器写入？

### 建议提交点

```bash
git add supabase src/features/comments src/features/activity src/features/tasks tests
git commit -m "feat: add comments and activity logs"
```

> 实施状态（2026-07-10）：已完成。已新增 `comments` 与 `activity_logs` 表、任务/工作区复合外键、评论不可重绑约束、显式 `GRANT`、成员/作者/Owner RLS，以及位于 `private` schema 的受限活动 trigger function。任务抽屉已接入评论列表、字数校验、提交和权限删除；工作区已接入只读活动页签、每批 20 条加载更多和系统 actor 回退。跨租户评论、非法作者、客户端伪造活动、状态去重、删除后日志保留及浏览器评论/活动流程均已覆盖；Realtime、附件和成员页仍按后续阶段实现。

## 11. 阶段 9：成员读取与稳定测试身份

### 目标

实现不泄露邮箱的成员列表，并建立可重复使用的 Alice（Owner）、Bob（成员）、Charlie（非成员）测试体系。

### Supabase 知识点与关联需求

- 知识点：Auth 用户与公开 profile 分离、多租户测试夹具、JWT claims 测试、最小数据暴露。
- 关联需求：MEMBER-01；TECH 第 6.1、6.3、8、14 节。

### 关键文件

- 修改：本地 Seed 和数据库测试 helper。
- 创建：`src/features/members/` 的 queries 和 components。
- 修改：工作区成员页签、任务负责人选项。
- 创建：Playwright auth fixture；测试凭据保存在被忽略的 `.env.test.local`，不提交真实凭据。

### 开发步骤

1. 统一 pgTAP 身份 helper，使测试可以显式切换 Alice、Bob、Charlie 和匿名角色。
2. 为两个工作区准备最小、确定性的数据库测试数据，确保 Bob 只加入其中一个工作区。
3. 建立 Playwright setup：通过本地 Auth API 在测试开始时创建用户，通过公开注册流程或测试 helper 建立会话；测试结束后清理。
4. 成员查询只关联 profiles 的 ID、昵称、头像和角色，不读取或返回 Auth 邮箱。
5. 实现成员页签、角色标签、Owner 置顶和空状态。
6. 复用同一成员查询作为任务负责人候选来源，服务端仍由 trigger 验证最终值。
7. 增加 Charlie 直接访问工作区 URL 的浏览器测试，确认页面不泄露工作区名称和成员数据。

### 验证命令与预期结果

```bash
pnpm exec supabase db reset
pnpm exec supabase test db --local
pnpm test
pnpm exec playwright test tests/e2e/members.spec.ts --repeat-each=2
pnpm typecheck
```

预期结果：成员只能读取所属工作区成员；列表不包含邮箱；Charlie 访问被拒绝；测试多次运行结果一致。

### 完成条件

- 数据库、单元和浏览器测试共享同一角色语义。
- Seed 和仓库中没有真实账号凭据。
- MEMBER-01 已实现，MEMBER-02/03 保留到阶段 14。

### 常见问题

- 从 `auth.users` 直接构建成员列表：会泄露邮箱且普通客户端无权访问 Auth 管理数据。
- 测试依赖人工创建用户：CI 和干净环境无法复现。
- 用前端下拉框保护负责人：仍需数据库约束防止直接 API 越权。

### 学习复盘

- Auth 用户数据与 `profiles` 公开资料为什么需要分离？
- 多租户测试为什么至少需要 Owner、成员、非成员三种身份？

### 建议提交点

```bash
git add supabase src/features/members src/features/tasks tests
git commit -m "test: add stable multi-tenant fixtures"
```

> 实施状态（2026-07-10）：已完成。Seed 已幂等提供可登录的 Alice、Bob、Charlie 及 Alpha/Beta 固定关系，数据库测试统一通过三身份 helper 切换 JWT；成员查询仅返回公开 Profile 字段、角色和加入时间，并按 Owner、加入时间、用户 ID 稳定排序。工作区已接入只读成员页签，任务负责人复用同一成员 DTO；Playwright Admin 夹具会随机创建、自动确认并完整清理临时身份和工作区，公开注册与 Mailpit 流程仍由 Auth E2E 覆盖。MEMBER-01、跨租户拒绝和 Seed Alice 登录均已覆盖；成员增删、头像 Storage 与 Realtime 保留到后续阶段。

## 12. 阶段 10：公共头像 Storage

### 目标

用户可以上传和替换自己的公开头像，不能写入或删除其他用户的路径。

### Supabase 知识点与关联需求

- 知识点：公共 bucket、`storage.objects` RLS、对象路径、MIME/大小限制、upsert 权限组合。
- 关联需求：PROFILE-02、STORAGE-01；TECH 第 11.1 节。

### 关键文件

- 创建迁移：`avatars` bucket、Storage policy、profile avatar_path 相关授权。
- 创建：`src/features/storage/avatar-*` 上传逻辑。
- 修改：`src/app/app/settings/page.tsx`、profile action 和头像组件。
- 测试：Storage pgTAP、文件校验单元测试、头像 Playwright 测试。

### 开发步骤

1. 通过迁移创建公共 `avatars` bucket，限制 JPEG、PNG、WebP 和 `2 MB`。
2. 为 `storage.objects` 编写 INSERT、SELECT、UPDATE、DELETE policy，校验 bucket 和首段路径等于当前用户 ID。
3. 明确 upsert 同时需要 INSERT、SELECT、UPDATE 权限；为缺少任一权限的失败场景编写测试。
4. 浏览器上传路径固定为 `{userId}/avatar.{ext}`，上传前校验 MIME、扩展名和文件大小。
5. 上传成功后通过受 RLS 保护的 profile action 更新 `avatar_path`。
6. 实现设置页上传进度、替换、错误状态和默认头像；公共 URL 只用于读取。
7. 编写 Alice 不能覆盖 Bob 头像、非法路径、非法类型、超限文件的测试。

### 验证命令与预期结果

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm test
pnpm exec playwright test tests/e2e/avatar.spec.ts
pnpm typecheck
```

预期结果：合法头像可公开访问并可替换；跨用户写入和删除被拒绝；非法文件在上传前被拦截。

### 完成条件

- PROFILE-02 和 STORAGE-01 完整实现。
- 浏览器不需要 secret key 即可完成合法直传。
- upsert policy 组合有自动化测试证明。

### 常见问题

- 只写 INSERT policy：首次上传成功，替换时失败。
- 只相信客户端 MIME：bucket 限制和应用校验都需要存在。
- 上传成功但 profile 更新失败：保留明确错误并允许用户重试更新资料。

### 学习复盘

- 公共 bucket 的“公开”影响读取还是也影响写入？
- Storage policy 如何从对象路径判断所有者？

### 建议提交点

```bash
git add supabase src/features/storage src/features/profiles src/app/app/settings tests
git commit -m "feat: add public avatar storage"
```

## 13. 阶段 11：私有任务附件 Storage

### 目标

工作区成员可以上传和下载私有任务附件；只有上传者或 Owner 可以删除；任务删除前正确清理对象。

### Supabase 知识点与关联需求

- 知识点：私有 bucket、路径授权、元数据表、signed URL、两阶段写入与补偿操作。
- 关联需求：STORAGE-02、TASK-03；TECH 第 6.6、11.2、16 节。

### 关键文件

- 创建迁移：`attachments` 表、索引、私有 bucket、表 RLS 和 `storage.objects` policy。
- 创建：`src/features/storage/attachments/` 的 validation、upload、download、delete 和 compensation。
- 修改：任务抽屉附件区、任务删除 action。
- 测试：附件表和 Storage pgTAP、补偿逻辑单元测试、附件 Playwright 测试。

### 开发步骤

1. 建立 attachments 表、复合外键、唯一 object_path、文件元数据约束、显式授权和 RLS。
2. 通过迁移创建私有 `attachments` bucket，限制常见图片、PDF、纯文本和 `10 MB`。
3. 对对象路径 `{workspaceId}/{taskId}/{uuid}-{safeFileName}` 编写成员上传/读取、上传者或 Owner 删除 policy。
4. 上传流程严格执行“对象上传成功后再写元数据”；元数据失败时立即删除刚上传对象并返回失败。
5. 下载 action 通过当前用户 Server Client 生成 `60 秒` signed URL，不返回永久公开地址。
6. 删除附件同时处理对象与元数据；任一步失败时页面展示真实状态，不提前移除文件项。
7. 删除任务前先列出并删除全部对象，确认成功后再删除任务记录。
8. 编写 Bob 下载成员附件、Charlie 读取失败、Bob 删除 Alice 附件失败、Owner 删除成功等测试。

### 验证命令与预期结果

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm test
pnpm exec playwright test tests/e2e/attachments.spec.ts
pnpm typecheck
```

预期结果：私有对象不能通过裸 URL 访问；成员可获取短时链接；删除权限和失败补偿符合设计；删除任务不遗留已知对象。

### 完成条件

- STORAGE-02 和带附件场景下的 TASK-03 完整实现。
- 附件业务列表来自 attachments 表，不把 bucket listing 当业务数据库。
- object_path、signed URL 和内部 Storage 错误不出现在用户提示中。

### 常见问题

- 先写元数据再上传：上传失败会留下不可用记录。
- 使用管理员客户端生成链接：会绕过用户 RLS，Next.js 中也不应持有 secret key。
- 删除数据库任务后再清对象：级联会先丢失对象路径，难以清理 Storage。

### 学习复盘

- 为什么附件需要 Storage 对象和业务元数据两份记录？
- 补偿删除解决了什么问题，为什么它不等同数据库事务？

### 建议提交点

```bash
git add supabase src/features/storage src/features/tasks tests
git commit -m "feat: add private task attachments"
```

## 14. 阶段 12：任务与评论 Postgres Changes

### 目标

两个浏览器窗口中的任务和评论无需刷新即可同步，同时正确处理重复事件、删除事件、断线重连和组件清理。

### Supabase 知识点与关联需求

- 知识点：Realtime publication、Postgres Changes filter、channel 生命周期、客户端 reducer、重新获取策略。
- 关联需求：REALTIME-01；TECH 第 12.1、16 节。

### 关键文件

- 创建迁移：将 tasks、comments 加入 `supabase_realtime` publication。
- 创建：`src/features/realtime/use-workspace-changes.ts`、任务与评论 event reducer。
- 修改：工作区任务页和任务抽屉。
- 测试：reducer 单元测试、双 browser context Playwright 测试。

### 开发步骤

1. 先查看当前 Realtime 官方文档和本地配置，再通过迁移幂等地把 tasks、comments 加入 publication。
2. 客户端只订阅当前 workspace_id，切换工作区或卸载组件时调用 `removeChannel`。
3. 为 INSERT、UPDATE、DELETE 建立纯 reducer；按主键去重，DELETE 只依赖主键移除。
4. 当前分页无法可靠合并事件时，重新获取当前页、统计和必要的详情数据。
5. channel 状态映射为连接中、已连接、重连和断开；SDK 重连成功后重新获取当前数据。
6. 为重复 INSERT、乱序 UPDATE、缺少旧行的 DELETE 和未知事件编写单元测试。
7. 使用两个 Playwright browser context 验证 Bob 新建任务、Alice 更新状态和双方评论同步。

### 验证命令与预期结果

```bash
pnpm exec supabase db reset
pnpm test
pnpm exec playwright test tests/e2e/realtime-changes.spec.ts
pnpm typecheck
```

预期结果：双窗口任务与评论同步；没有重复项；关闭页面或切换工作区后旧 channel 被移除；断线恢复后数据与数据库一致。

### 完成条件

- REALTIME-01 完整实现。
- Realtime 只负责加速界面更新，最终状态仍可通过重新查询恢复。
- 订阅严格按工作区过滤，不订阅全表后再由前端过滤。

### 常见问题

- React effect 重复创建 channel：检查依赖和 cleanup。
- DELETE 依赖完整旧行：默认事件可能只有主键，应按主键移除或重新获取。
- 盲目乐观合并分页数据：可能破坏排序和筛选，应选择重新获取。

### 学习复盘

- Postgres Changes 与普通查询在一致性保证上有什么不同？
- 为什么收到事件后仍需要“重新获取”兜底？

### 建议提交点

```bash
git add supabase src/features/realtime src/features/tasks src/features/comments tests
git commit -m "feat: sync tasks and comments in realtime"
```

## 15. 阶段 13：Presence、Broadcast 与 Realtime Authorization

### 目标

工作区成员能看到在线成员和评论输入状态，非成员不能加入、发送或接收私有频道消息。

### Supabase 知识点与关联需求

- 知识点：私有 channel、Presence、Broadcast、`realtime.messages` RLS、topic 授权、临时状态。
- 关联需求：REALTIME-02、REALTIME-03；TECH 第 12.2、12.3 节。

### 关键文件

- 创建迁移：`realtime.messages` SELECT/INSERT policy 和权限辅助逻辑。
- 创建：`src/features/realtime/use-workspace-presence.ts`、`use-comment-typing.ts`。
- 修改：工作区头部在线头像、评论输入状态、连接状态条。
- 测试：Realtime policy pgTAP、节流/超时单元测试、Presence/Broadcast Playwright 测试。

### 开发步骤

1. 确认当前项目启用私有 Realtime channel 和授权能力。
2. 在 `realtime.messages` 上为 authenticated 建立 SELECT/INSERT policy：topic 必须是 `workspace:{uuid}`，UUID 必须对应当前成员，extension 只允许 presence 或 broadcast。
3. channel 名固定为 `workspace:{workspaceId}`，配置 `{ private: true }`。
4. Presence payload 只包含 userId、displayName、onlineAt，不包含邮箱、token 或角色授权信息。
5. typing payload 只包含 taskId、userId、isTyping；发送节流为最多每 `500 ms` 一次，停止输入 `2 秒` 后发送 false。
6. 页面离开、任务切换、断线时清理 timer、Presence 和 typing 状态，不持久化这些临时数据。
7. 编写 Bob 可加入、Charlie 被拒绝以及被移除用户重新连接失败的自动化测试。

### 验证命令与预期结果

```bash
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm test
pnpm exec playwright test tests/e2e/realtime-channel.spec.ts
pnpm typecheck
```

预期结果：Alice 和 Bob 互相看到在线与输入状态；Charlie 无法加入频道；停止输入后提示自动消失；断线不残留旧状态。

### 完成条件

- REALTIME-02、REALTIME-03 完整实现。
- 频道授权来自数据库成员关系，不信任 Presence payload 中的字段。
- policy 修改后测试会刷新 JWT 或重新连接，避免缓存旧授权。

### 常见问题

- 使用公开 channel：非成员可以监听临时状态。
- 把在线状态写数据库：Presence 已适合短暂连接状态，不需要永久记录。
- 把 displayName 当授权依据：昵称可修改，只能用于展示。

### 学习复盘

- Presence、Broadcast 和 Postgres Changes 分别适合什么数据？
- Realtime topic policy 如何把 WebSocket 频道重新绑定到数据库成员关系？

### 建议提交点

```bash
git add supabase src/features/realtime src/features/comments tests
git commit -m "feat: add private workspace presence"
```

## 16. 阶段 14：Edge Function 与成员管理

### 目标

Owner 可以按邮箱添加已注册用户并移除普通成员；secret key 只在 Edge Function 中用于 Auth 管理查询。

### Supabase 知识点与关联需求

- 知识点：Edge Runtime、用户 JWT、管理员客户端、最小特权、状态码契约、CORS、依赖注入。
- 关联需求：MEMBER-02、MEMBER-03、EDGE-01；TECH 第 13 节。

### 关键文件

- 创建：`supabase/functions/add-member-by-email/index.ts`、`handler.ts`、`schema.ts`。
- 修改：`supabase/config.toml` 的函数 JWT 验证配置。
- 创建或修改：`src/features/members/actions.ts`、添加成员弹窗、移除成员确认框。
- 测试：Edge handler 单元测试、成员管理 pgTAP 和 Playwright 测试。

### 开发步骤

1. 查看当前 Edge Function Auth 官方文档，并运行 `pnpm exec supabase functions --help` 和相关子命令 `--help`。
2. 运行 `pnpm exec supabase functions new add-member-by-email` 创建函数骨架，保持平台 JWT 验证开启。
3. 用 Zod 校验 POST 请求中的 workspaceId 和标准化邮箱；OPTIONS 单独处理，CORS 只允许配置的应用 origin。
4. 从调用者 Authorization header 创建用户客户端，先通过 RLS 和显式 role 检查证明调用者是 Owner。
5. 权限检查成功后才创建管理员客户端；管理员客户端只用于分页查找 Auth 用户和写入成员关系。
6. 按 TECH 契约映射 200、400、401、403、404、409、500；每次请求生成 request ID，日志不记录邮箱列表、Authorization 或 apikey。
7. handler 通过依赖注入接收用户客户端和管理员客户端，单元测试不读取真实 secret key。
8. 实现添加成员弹窗和错误文案；实现 Owner 移除普通成员 action，禁止移除 Owner。
9. 被移除用户收到权限失败后清空工作区缓存并取消 Realtime channel。

### 验证命令与预期结果

```bash
pnpm exec supabase functions serve --help
pnpm test
pnpm exec supabase test db
pnpm exec playwright test tests/e2e/member-management.spec.ts
pnpm typecheck
```

本地函数启动命令以当前 CLI `--help` 为准。预期结果：Alice 能添加和移除 Bob；Bob 不能管理成员；未注册邮箱和重复成员得到明确响应；secret key 不出现在浏览器或测试日志。

### 完成条件

- MEMBER-02、MEMBER-03、EDGE-01 完整实现。
- 管理员客户端永远不会在 Owner 权限检查前使用。
- 函数环境之外不存在 secret/service key。

### 常见问题

- 用管理员客户端执行整条流程：会绕过 RLS，无法证明调用者有 Owner 权限。
- 关闭 JWT 验证后手工解析不可信 token：增加错误面和攻击面。
- 无限扫描 Auth 用户：Demo 限制最多检查 1000 个用户，生产系统应使用邀请流程。

### 学习复盘

- 为什么一个函数同时需要用户客户端和管理员客户端？
- 哪一步是权限证明，哪一步是特权操作？

### 建议提交点

```bash
git add supabase/functions supabase/config.toml src/features/members tests
git commit -m "feat: add edge member management"
```

## 17. 阶段 15：完整本地测试与安全验收

### 目标

从干净数据库重建项目，证明主流程、权限矩阵、Storage、Realtime 和 Edge Function 均可重复验证。

### Supabase 知识点与关联需求

- 知识点：pgTAP、数据库授权矩阵、RLS 回归、浏览器双上下文、安全与性能 advisors。
- 关联范围：PRD 第 9 节；TECH 第 14、16、18 节；DESIGN 第 14 节。

### 关键文件

- 完善：`supabase/tests/database/`、`tests/unit/`、`tests/e2e/`。
- 修改：测试 scripts 和 Playwright 配置。
- 本阶段只修复验收发现的问题，不新增产品功能。

### 开发步骤

1. 建立 PRD 功能编号到测试文件的映射，确认 AUTH、PROFILE、WORKSPACE、MEMBER、TASK、COMMENT、ACTIVITY、STORAGE、REALTIME、EDGE 全部覆盖。
2. 从停止的本地 Supabase 开始启动并执行 `db reset`，证明环境不依赖 Dashboard 手工状态。
3. 运行全部 pgTAP，重点复查 Alice、Bob、Charlie 对每张表的 SELECT、INSERT、UPDATE、DELETE。
4. 运行全部 Vitest，覆盖 validation、错误映射、Realtime reducer、上传补偿和 Edge handler。
5. 运行全部 Playwright，覆盖 Auth、工作区、任务、评论、成员、Storage、双窗口 Realtime 和移除成员。
6. 运行 lint、类型检查和生产构建，并扫描浏览器构建与日志中的 secret-like 变量名。
7. 运行当前 CLI 支持的数据库 security/performance advisors；修复高优先级问题，对可接受提示记录原因。
8. 手工执行 PRD 9.1 的 Alice/Bob/Charlie 主流程，记录实际结果。

### 验证命令与预期结果

```bash
pnpm exec supabase stop
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase test db
pnpm test
pnpm exec playwright test
pnpm lint
pnpm typecheck
pnpm build
```

advisors 命令先通过 `pnpm exec supabase db --help` 确认。预期结果：全部命令退出码为 0；没有未解释的高优先级安全问题；主流程七步全部通过。

### 完成条件

- 干净本地环境可以只依赖仓库内容重建。
- 所有自动化测试通过，且测试确实包含拒绝路径。
- 浏览器构建和日志中没有 secret/service key、token 或真实凭据。

### 常见问题

- 只验证成功路径：多租户项目必须证明非法访问失败且数据未改变。
- 测试顺序依赖：每个测试文件应自行准备或重置所需数据。
- Advisors 命令版本不匹配：先查看 CLI `--help`，必要时使用官方支持的替代入口。

### 学习复盘

- 哪个测试最直接证明 RLS 而不是前端在保护数据？
- 如果只保留三类测试中的一种，哪些安全或交互错误会漏掉？

### 建议提交点

```bash
git add supabase/tests tests package.json pnpm-lock.yaml
git commit -m "test: complete local acceptance coverage"
```

## 18. 阶段 16：连接托管 Supabase 并云端验收

### 目标

在不部署 Next.js 的前提下，让本地应用连接托管 Supabase，验证迁移、邮箱 Auth、GitHub OAuth、Storage、Realtime 和 Edge Function。

### Supabase 知识点与关联需求

- 知识点：CLI login/link、远端迁移、redirect URL、provider、function deploy、远端 typegen、advisors。
- 关联范围：PRD 学习阶段 7 和 Definition of Done；TECH 第 15、18 节。

### 关键文件

- 修改：`.env.local` 的本地值切换为托管项目 URL 与 publishable key；文件仍不提交。
- 可能修改：迁移、函数配置或文档，仅用于修复真实云端差异。
- 不新增 Next.js 部署配置。

### 开发步骤

1. 创建或选择专用的空 Supabase 学习项目，不连接含生产数据的项目。
2. 运行 `pnpm exec supabase login`；从环境变量读取项目 ref，再执行 `pnpm exec supabase link --project-ref "$SUPABASE_PROJECT_REF"`。
3. 先查看远端 migration list 和 schema 状态；远端非空时停止并审查，不直接覆盖。
4. 推送已审查迁移，确认远端 migration list 与本地一致。
5. 在 Dashboard 配置 Site URL、允许的 redirect URL 和 GitHub provider；GitHub secret 只保存在平台配置中。
6. 部署 `add-member-by-email`，保持 JWT verification 开启，并配置允许 origin 和所需 Edge secrets。
7. 将 `.env.local` 切换到远端 URL 与 publishable key，运行本地 Next.js 完成 Auth、工作区、Storage、Realtime 和成员管理 smoke test。
8. 从远端生成 TypeScript 类型并与本地类型比较；任何差异都必须由迁移解释。
9. 运行远端 security/performance advisors，修复高优先级问题。
10. 验收结束后确认 Git 状态没有 `.env.local`、token、项目 secret 或临时日志。

### 验证命令与预期结果

```bash
pnpm exec supabase migration list
pnpm exec supabase gen types typescript --linked > src/types/database.remote.ts
diff -u src/types/database.ts src/types/database.remote.ts
pnpm lint
pnpm typecheck
pnpm build
git status --short
```

typegen 的远端参数先通过当前 CLI `--help` 确认。预期结果：迁移一致；类型无无法解释的差异；本地 Next.js 连接远端后主流程通过；Git 状态不包含秘密文件。比较完成后删除临时 `database.remote.ts`，不提交重复生成文件。

### 完成条件

- 邮箱 Auth、GitHub OAuth、Storage、Realtime 和 Edge Function 均在托管项目完成 smoke test。
- Advisors 没有未处理的高优先级问题。
- 远端 schema 与仓库迁移一致，项目仍不依赖 Dashboard 手工建表或建 policy。

### 常见问题

- 在非空项目直接推迁移：可能覆盖或冲突，必须先审查远端状态。
- 回调地址只配置生产形式：本项目需要允许本地 Next.js callback。
- 把 GitHub client secret 写进 `.env.local`：Provider secret 应保存在 Supabase 平台配置。

### 学习复盘

- 本地 Supabase 与托管 Supabase 哪些配置由迁移同步，哪些必须在平台配置？
- 远端类型与本地类型不一致时，应以什么作为 schema 真相来源？

### 建议提交点

只有云端验证引发了可解释的迁移、函数或文档修复时才提交；不提交环境变量和临时远端类型文件。

## 19. 需求到阶段映射

| 需求 | 实施阶段 | 主要验证 |
| --- | --- | --- |
| AUTH-01、AUTH-02、AUTH-03、AUTH-04、AUTH-05 | 阶段 4、5 | Auth Playwright、受保护路由 |
| PROFILE-01 | 阶段 4 | profile trigger pgTAP |
| PROFILE-02 | 阶段 10 | 头像 Storage pgTAP 与 E2E |
| WORKSPACE-01、WORKSPACE-02 | 阶段 6 | workspace RLS、RPC、E2E |
| MEMBER-01 | 阶段 9 | 成员查询与跨租户测试 |
| MEMBER-02、MEMBER-03 | 阶段 14 | Edge handler、RLS、E2E |
| TASK-01、TASK-02、TASK-03、TASK-04 | 阶段 7、11 | 任务 CRUD、统计、附件清理 |
| COMMENT-01、ACTIVITY-01 | 阶段 8 | comments/activity pgTAP 与 E2E |
| STORAGE-01 | 阶段 10 | 公共头像和路径越权测试 |
| STORAGE-02 | 阶段 11 | 私有附件、signed URL、补偿测试 |
| REALTIME-01 | 阶段 12 | 双窗口 Postgres Changes E2E |
| REALTIME-02、REALTIME-03 | 阶段 13 | Presence/Broadcast 授权测试 |
| EDGE-01 | 阶段 14 | Edge 状态码、Owner 权限测试 |
| 全部主流程 | 阶段 15、16 | 本地完整验收与云端 smoke test |

## 20. 每阶段结束检查表

进入下一阶段前，逐项确认：

- [ ] 本阶段关联需求全部有实现入口和验证方式。
- [ ] 新表、视图、函数、bucket、publication 或 policy 来自迁移。
- [ ] 新业务表已显式 `GRANT`、启用 RLS，并有合法与越权测试。
- [ ] 数据库可以执行 `db reset`，TypeScript 类型已重新生成。
- [ ] 相关 pgTAP、Vitest、Playwright、lint 和类型检查通过。
- [ ] 页面包含加载、空状态、错误和权限失败反馈。
- [ ] 没有 secret/service key、token、真实凭据或敏感日志进入 Git。
- [ ] 实现没有超出 PRD 的“明确不做”范围。
- [ ] 能回答本阶段的学习复盘问题。
- [ ] Git 提交只包含当前阶段的聚焦改动。

如果任意一项不能确认，保留在当前阶段继续修复，不用后续功能掩盖当前问题。
