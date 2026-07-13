# 验收记录

本文档记录阶段 15 的完整本地验收和阶段 16 的托管 Supabase 云端验收。云端结果来自专用学习项目的实际迁移、平台配置和浏览器 smoke test，不以本地模拟结果替代。

## PRD 测试映射

| PRD 能力 | 数据库 / 单元测试 | 浏览器验收 |
| --- | --- | --- |
| AUTH-01 | `tests/unit/auth-validation.test.ts`、`supabase/tests/database/profiles.test.sql` | `tests/e2e/auth.spec.ts` |
| AUTH-02 | `tests/unit/auth-redirect.test.ts`、`tests/unit/supabase-env.test.ts` | `tests/e2e/auth.spec.ts`、`tests/e2e/home.spec.ts` |
| AUTH-03 | `tests/unit/auth-actions.test.ts` 验证 GitHub provider、callback 和稳定错误映射 | 阶段 16 已使用真实 GitHub provider 验证外部跳转、PKCE callback 与受保护页面 |
| AUTH-04～05 | `tests/unit/auth-validation.test.ts`、`tests/unit/auth-forms-ui.test.tsx` | `tests/e2e/auth.spec.ts` |
| PROFILE-01 | `supabase/tests/database/profiles.test.sql`、`supabase/tests/database/authorization_matrix.test.sql` | `tests/e2e/auth.spec.ts` |
| PROFILE-02 | `supabase/tests/database/avatar_storage.test.sql`、`tests/unit/avatar-storage.test.ts`、`tests/unit/profile-actions.test.ts` | `tests/e2e/avatar.spec.ts` |
| WORKSPACE-01～02 | `supabase/tests/database/workspaces.test.sql`、`supabase/tests/database/authorization_matrix.test.sql`、`tests/unit/workspace-actions.test.ts`、`tests/unit/workspace-queries.test.ts` | `tests/e2e/workspaces.spec.ts` |
| MEMBER-01 | `supabase/tests/database/members.test.sql`、`tests/unit/member-queries.test.ts` | `tests/e2e/members.spec.ts` |
| MEMBER-02～03 | `supabase/tests/database/members.test.sql`、`tests/unit/add-member-edge-handler.test.ts`、`tests/unit/member-actions.test.ts` | `tests/e2e/member-management.spec.ts` |
| TASK-01～04 | `supabase/tests/database/tasks.test.sql`、`supabase/tests/database/authorization_matrix.test.sql`、`tests/unit/task-validation.test.ts`、`tests/unit/task-actions.test.ts`、`tests/unit/task-queries.test.ts` | `tests/e2e/tasks.spec.ts` |
| COMMENT-01 | `supabase/tests/database/comments_activity.test.sql`、`supabase/tests/database/authorization_matrix.test.sql`、`tests/unit/comment-validation.test.ts`、`tests/unit/comment-actions.test.ts` | `tests/e2e/comments-activity.spec.ts`、`tests/e2e/realtime-changes.spec.ts` |
| ACTIVITY-01 | `supabase/tests/database/comments_activity.test.sql`、`supabase/tests/database/authorization_matrix.test.sql`、`tests/unit/activity-queries.test.ts` | `tests/e2e/comments-activity.spec.ts`、`tests/e2e/tasks.spec.ts` |
| STORAGE-01 | `supabase/tests/database/avatar_storage.test.sql`、`tests/unit/avatar-storage.test.ts` | `tests/e2e/avatar.spec.ts` |
| STORAGE-02 | `supabase/tests/database/attachments_storage.test.sql`、`supabase/tests/database/authorization_matrix.test.sql`、`tests/unit/attachment-validation.test.ts`、`tests/unit/attachment-compensation.test.ts` | `tests/e2e/attachments.spec.ts` |
| REALTIME-01 | `supabase/tests/database/realtime_changes.test.sql`、`tests/unit/realtime-reducer.test.ts` | `tests/e2e/realtime-changes.spec.ts` |
| REALTIME-02～03 | `supabase/tests/database/realtime_presence.test.sql`、`tests/unit/use-workspace-presence.test.tsx`、`tests/unit/use-comment-typing.test.tsx` | `tests/e2e/realtime-channel.spec.ts` |
| EDGE-01 | `tests/unit/add-member-edge-handler.test.ts` 覆盖 200、400、401、403、404、409、500 | `tests/e2e/member-management.spec.ts` |
| DESIGN 第 14 节 | `tests/unit/design-acceptance.test.ts` 验证正文、弱化文字、主按钮 WCAG AA 对比度与焦点环 | `tests/e2e/design-acceptance.spec.ts` 验证 390px 窄屏无水平溢出且核心任务操作可达 |

数据库测试固定覆盖 Alice（Owner）、Bob（成员）与 Charlie（非成员）。各领域测试验证合法 CRUD；`authorization_matrix.test.sql` 逐表补齐 Charlie 对 Alpha 的 SELECT、INSERT、UPDATE、DELETE 拒绝及数据未改变，并验证 profiles/activity/attachments 的表级写权限边界。

## PRD 9.1 主流程记录

2026-07-12 从停止的本地 Supabase 开始，执行 `supabase start` 与 `supabase db reset` 后，在本地浏览器创建独立的 `Stage 15 Manual Alpha` 工作区并逐项观察：

1. Alice 登录后创建工作区：页面进入新工作区，显示 `Owner`、1 位成员和空任务列表；注册、邮件确认另由 `auth.spec.ts` 从真实 Mailpit 链路复核。
2. Alice 输入 `bob@example.com`：成员数从 1 变为 2，列表显示 Bob 为“成员”。
3. Bob 登录后能进入该工作区并创建 `Stage 15 manual task`；Alice 再登录后能读取该任务。附件上传、签名下载和无需刷新同步由 `attachments.spec.ts`、`realtime-changes.spec.ts` 复核。
4. Alice 将任务从“待办”改为“已完成”并发表 `Alice manual acceptance comment`，统计变为已完成 1，评论立即出现在详情中；typing 双窗口状态由 `realtime-channel.spec.ts` 复核。
5. Bob 的成员页仅显示成员列表，没有“添加成员”或“移除”操作；附件上传者/Owner 删除边界由 `attachments.spec.ts` 复核。
6. Charlie 直接打开工作区 UUID，页面显示“工作区不存在或无权访问”；数据、Storage 与私有频道拒绝由 pgTAP 和 `realtime-channel.spec.ts` 复核。
7. Alice 移除 Bob 后成员数回到 1；Bob 重新登录并打开同一 UUID，页面显示“工作区不存在或无权访问”；Realtime 重连拒绝由 `realtime-channel.spec.ts` 复核。

浏览器走查期间读取的控制台日志只有开发期 HMR/React DevTools 信息，没有邮箱、Authorization、apikey、token 或 secret 值。走查产生的临时工作区随后通过 `db reset` 清理。

## 执行顺序

```bash
pnpm exec supabase stop
pnpm exec supabase start
pnpm exec supabase db reset
pnpm test:db
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm check:secrets
pnpm check:advisors
```

`check:secrets` 必须在生产构建后运行。它扫描 `.next/static` 和 `.next/dev/logs` 中的 secret/service-role 变量名、`sb_secret_` 前缀及本地已配置的 secret 值，并检查 `src/` 与 Edge Function 的日志调用是否传入数据库原始 message、邮箱、Authorization、apikey、token、密码或 secret 字段；失败输出只显示文件和标记名，不回显凭据。

## 阶段 15 结果

- 9 个迁移和 `supabase/seed.sql` 可从干净数据库重建。
- pgTAP：10 个文件、232 条测试通过。
- Vitest：52 个文件、200 条测试通过。
- Playwright：20 条测试通过。
- ESLint、TypeScript 和生产构建通过。
- 浏览器构建产物、开发运行日志和应用日志调用 secret 扫描通过；应用日志只记录操作、错误码或 request ID，不记录邮箱列表、Authorization、apikey、token、密码或 secret。
- 390px 窄屏无水平溢出，核心任务操作可访问；正文、弱化文字、主按钮对比度及全局焦点环满足 DESIGN 基础验收。
- Supabase security/performance advisors 在 `warn` 级别返回 `No issues found`。

## 阶段 16 托管云端验收

2026-07-13 使用仓库固定的 Supabase CLI 2.109.0 和临时 HOME，在个人账号创建新加坡区专用免费项目 `supaboard-learning`。推送前确认远端无迁移、业务表和用户；未连接生产数据、未上传 Seed、未部署 Next.js。

### 平台配置与一致性

- 10 个仓库迁移已全部应用，`migration list --linked` 本地与远端逐项一致，最终 `db push --linked --dry-run` 返回远端已是最新状态。
- Auth Site URL 为 `http://localhost:3000`，允许 `localhost` 与 `127.0.0.1` 的本地回调；邮箱注册和邮箱确认开启。
- 个人 GitHub OAuth App 已连接真实 Provider；Client Secret 只在 GitHub 与 Supabase Dashboard 间由用户输入，未进入聊天、命令、环境文件或 Git。
- Realtime 仅允许私有频道；`delete-task` 和 `add-member-by-email` 均以 `verify_jwt = true` 部署，Edge secret 仅保存 `APP_ORIGIN=http://localhost:3000`。
- 远端生成类型与 `src/types/database.ts` 执行严格 diff，仅出现托管 PostgREST 14.5 的 `__InternalSupabase` 运行时元数据；公开表、函数和枚举类型没有差异。该项不是迁移或 schema 漂移，因此不写入以本地迁移为真相来源的仓库类型。

### 浏览器 smoke test

1. 两个不同邮箱分别完成注册、邮件确认、登录与刷新后的受保护页面访问；未额外触发密码恢复邮件。
2. 独立 GitHub 身份完成 OAuth 授权、PKCE callback、登录和受保护页面访问。
3. Owner 创建工作区、任务和评论，上传公共头像与私有附件，并通过签名 URL 下载附件。
4. `add-member-by-email` 将第二邮箱加入工作区；两个隔离浏览器窗口显示在线 2 人，Postgres Changes、Presence 和 typing Broadcast 均无需刷新生效。
5. `delete-task` 删除带附件任务后，任务、评论、附件元数据和 `task-attachments` Storage 对象均为 0。
6. 移除成员后，第二用户刷新和直接访问工作区 URL 均被拒绝。

仅私有频道首次在托管环境暴露出真实兼容差异：默认 Postgres Changes 频道被平台以 `PrivateOnly` 拒绝，而 Presence 私有频道仍可连接。客户端现显式设置 Postgres Changes 频道 `private: true`；迁移 `20260713070436_authorize_private_postgres_changes.sql` 为 `workspace-postgres:<workspace-id>` 增加成员级只读 topic 授权。新增 pgTAP 覆盖 Owner、成员、非成员和异常 topic，修复后页面稳定显示“实时同步：已连接”，双窗口测试通过。

### Advisors 与清理

- 云端修复后重新执行本地 `db reset`；pgTAP 10 个文件、242 条测试，Vitest 200 条测试和 Playwright 20 条测试全部通过，ESLint、TypeScript、生产构建、secret 扫描与 local advisors 通过。
- 远端 security advisors 无问题，performance advisors 无 `WARN` 或 `ERROR`。
- performance advisors 保留 5 个 `INFO`：3 个未单独覆盖的外键索引和 2 个尚未使用的索引。项目在验收后为空，现有查询索引仍服务既定访问路径；这些提示不足以支持阶段 16 扩张 schema，因此记录但不新增或删除索引。
- 验收结束后删除测试工作区、三个 Auth 用户、头像、附件和空目录占位对象。最终 `auth.users`、`profiles`、工作区、成员、任务、评论、附件与 `storage.objects` 计数均为 0。
- 托管迁移、GitHub Provider、Auth URL、私有 Realtime 设置、Edge secret 和两个函数部署保留；本地 `.env.local` 继续使用托管 Project URL 与 publishable key，未保存 secret/service key。
