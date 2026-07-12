# 本地验收

本文档记录阶段 15 的本地验收范围。云端 GitHub OAuth、远端迁移、函数部署与托管项目 smoke test 属于阶段 16，不以本地模拟结果替代。

## PRD 测试映射

| PRD 能力 | 数据库 / 单元测试 | 浏览器验收 |
| --- | --- | --- |
| AUTH-01 | `tests/unit/auth-validation.test.ts`、`supabase/tests/database/profiles.test.sql` | `tests/e2e/auth.spec.ts` |
| AUTH-02 | `tests/unit/auth-redirect.test.ts`、`tests/unit/supabase-env.test.ts` | `tests/e2e/auth.spec.ts`、`tests/e2e/home.spec.ts` |
| AUTH-03 | `tests/unit/auth-actions.test.ts` 验证 GitHub provider、callback 和稳定错误映射 | 阶段 16 使用真实 GitHub provider 验证外部跳转与回调 |
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
