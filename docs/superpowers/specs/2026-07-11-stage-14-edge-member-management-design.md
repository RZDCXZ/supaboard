# 阶段 14：Edge Function 与成员管理设计

## 背景与范围

阶段 14 完成 `MEMBER-02`、`MEMBER-03` 与 `EDGE-01`：工作区 Owner 可以按邮箱添加已注册用户，并移除普通成员。管理员凭据只存在于 Edge Function 运行时；普通应用请求继续使用当前用户身份并受 RLS 约束。

本阶段不实现邀请邮件、待接受邀请、角色变更、Owner 转移、批量成员管理或阶段 15 的全量验收扩展。

## 已确认决策

采用“低层认证原语 + 服务端优先 UI”方案：

- Edge Function 使用 `@supabase/server/core` 的认证与客户端原语，先验证用户 JWT 并创建 RLS 用户客户端。
- 用户客户端证明调用者是目标工作区 Owner 后，才创建管理员客户端。
- Next.js 通过 Server Action 调用 Edge Function；成员列表继续由 Server Component 查询，弹窗与确认框保持为小型 Client Components。
- CORS 使用 `APP_ORIGINS` 显式白名单。本地默认允许 `http://localhost:3000` 与 `http://127.0.0.1:3000`，云端通过函数环境变量覆盖。

未采用的方案：

- 高层 `withSupabase` 会提前组装包含管理员客户端的完整上下文，不利于证明“先 Owner 检查、后创建管理员客户端”的顺序。
- 浏览器直接调用 Edge Function 会增加会话、CORS 和错误状态的客户端职责，不符合项目现有的服务端优先结构。

## 架构与文件边界

### Edge Function

使用官方 CLI 创建 `add-member-by-email` 骨架，再收敛为以下职责：

- `supabase/functions/add-member-by-email/schema.ts`
  - 定义请求体 Zod schema。
  - 校验 `workspaceId` 为 UUID。
  - 对邮箱执行去除首尾空白、小写标准化和标准邮箱校验。
- `supabase/functions/add-member-by-email/handler.ts`
  - 定义与 Supabase SDK 解耦的服务接口。
  - 编排方法、认证、Owner 权限、用户查找、成员写入和错误映射。
  - 只有 Owner 校验成功后才调用惰性的管理员服务工厂。
- `supabase/functions/add-member-by-email/index.ts`
  - 处理 `APP_ORIGINS` 白名单与 OPTIONS。
  - 使用 `verifyAuth(request, { auth: "user" })` 验证 Authorization header。
  - 使用已验证 token 创建 RLS 用户客户端。
  - 在 handler 请求管理员服务后才调用 `createAdminClient()`。
- `supabase/functions/add-member-by-email/deno.json`
  - 固定 `@supabase/server`、`@supabase/functions-js` 和 Zod 版本，不使用浮动依赖。
- `supabase/config.toml`
  - 为 `add-member-by-email` 配置 `enabled = true`、`verify_jwt = true`、import map 和入口文件。

### Next.js 成员功能

- `src/features/members/validation.ts`
  - 定义添加和移除成员的输入 schema，并生成字段级错误。
- `src/features/members/types.ts`
  - 增加稳定的成员管理 ActionResult、错误码和输入类型。
- `src/features/members/actions.ts`
  - `addMemberByEmail`：验证输入与当前会话后，通过用户的 Server Supabase Client 调用 Edge Function，并映射稳定错误。
  - `removeWorkspaceMember`：使用当前用户客户端删除目标工作区中 `role = 'member'` 的成员记录；不使用管理员客户端。
  - 成功后重新验证工作区成员页和工作区主页面。
- `src/features/members/add-member-dialog.tsx`
  - Owner 使用的邮箱弹窗，展示字段错误、未注册、重复成员、权限和未知错误。
- `src/features/members/remove-member-dialog.tsx`
  - 对普通成员显示危险确认框，明确移除后续请求和重新连接将失去权限。
- `src/features/members/member-list.tsx`
  - 保持公开资料列表结构，只在 Owner 视图中为普通成员渲染移除入口。
- `src/app/app/workspaces/[workspaceId]/page.tsx`
  - 成员页签的 PageHeader 为 Owner 渲染“添加成员”。
  - 普通成员仍可查看列表，但不接收管理控件。

### 权限失效处理

- 新增聚焦的工作区访问守卫，接收工作区操作的 `FORBIDDEN` 结果或 Realtime channel 的授权失败信号。
- 守卫先用当前用户客户端复查自己的 `workspace_members` 记录：
  - 记录仍存在时保留原业务错误，避免把“任务不存在”等情况误判为成员被移除。
  - 记录不存在时调用 `removeAllChannels()`，清除当前工作区的乐观数据、Presence 与 typing 状态，导航到 `/app?notice=membership-removed` 并刷新服务端数据。
  - 网络错误不视为权限撤销，继续展示原错误或断线状态。
- `use-workspace-changes.ts` 在私有频道返回授权错误时只发出“可能失去访问权”的信号，最终判断仍由成员关系复查完成。

## 添加成员数据流

1. Owner 在成员页输入邮箱并提交。
2. Server Action 校验表单并确认存在用户会话。
3. Server Supabase Client 携带当前用户 JWT 调用 `add-member-by-email`。
4. Edge gateway 与函数认证层验证 JWT；函数创建用户上下文客户端。
5. 用户客户端在 `workspace_members` 中查询调用者自己的 Owner 记录。RLS 和显式 `role = 'owner'` 必须同时通过。
6. 权限通过后才创建管理员客户端。
7. 管理员 Auth API 每页读取 100 个用户，最多 10 页；对标准化邮箱做精确匹配，最多检查 1000 个 Demo 用户。
8. 未找到返回 404；找到后以 `role = 'member'`、`added_by = callerId` 插入成员关系。
9. 主键冲突返回 409；成功返回成员 ID 与角色。
10. Server Action 重新验证页面，弹窗关闭并刷新成员列表。

管理员客户端不会参与第 5 步，也不会在权限失败时创建或调用。

## 移除成员数据流

1. Owner 在普通成员行点击“移除”并确认。
2. Server Action 校验 `workspaceId` 与 `memberId`，确认当前会话。
3. 用户客户端删除同时匹配工作区、目标用户和 `role = 'member'` 的记录，并请求返回被删除 ID。
4. 现有 RLS 限制只有 Owner 能删除；现有数据库触发器继续阻止 Owner 成员关系被删除或降级。
5. 返回 0 行统一映射为不透露成员存在性的权限错误。
6. 成功后重新验证工作区页面。
7. 被移除用户下一次操作或 Realtime 重连失败时进入权限失效处理流程。

本阶段预计不新增数据库迁移：现有 `workspace_members` GRANT、RLS、唯一约束和 Owner 保护触发器已覆盖所需写入边界。若测试发现数据库缺口，才使用 Supabase CLI 创建聚焦迁移。

## CORS、认证与秘密边界

- `verify_jwt = true` 保持开启；无效或缺失 JWT 在业务 handler 前返回 401。
- OPTIONS 只为 `APP_ORIGINS` 中的来源返回预检响应。
- 带 Origin 的实际请求必须命中白名单；响应只回显匹配的精确 Origin，并设置 `Vary: Origin`。
- 无 Origin 的 Server Action、CLI 和测试调用允许进入认证流程，但不附加浏览器 CORS 响应头。
- CORS 不是授权边界；Owner 检查和 RLS 始终执行。
- secret/service key 不进入 Next.js 环境变量、浏览器包、Action 参数、日志或响应。
- 日志只包含 request ID、失败阶段和稳定错误码，不包含 Authorization、apikey、邮箱列表或完整请求体。

## 错误契约

Edge Function 使用稳定 JSON envelope：

```json
{
  "error": {
    "code": "MEMBER_ALREADY_EXISTS",
    "message": "该用户已经是工作区成员",
    "requestId": "uuid"
  }
}
```

| HTTP | code | 场景 |
| --- | --- | --- |
| 200 | - | 添加成功，返回 `member.userId` 与 `member.role` |
| 400 | `VALIDATION_ERROR` | JSON、UUID 或邮箱无效 |
| 401 | `NOT_AUTHENTICATED` | JWT 缺失或无效 |
| 403 | `FORBIDDEN` | 调用者不是目标工作区 Owner |
| 403 | `ORIGIN_NOT_ALLOWED` | 浏览器 Origin 不在白名单 |
| 404 | `USER_NOT_FOUND` | 1000 个 Demo 用户范围内没有匹配邮箱 |
| 405 | `METHOD_NOT_ALLOWED` | 非 POST 请求 |
| 409 | `MEMBER_ALREADY_EXISTS` | 目标用户已经是成员 |
| 500 | `INTERNAL_ERROR` | Auth 分页、成员写入或未预期运行时失败 |

Next.js Action 将这些 code 映射为中文稳定文案；原始 Supabase 错误不传给 UI。

## 测试策略

按 TDD 完成以下覆盖：

### Vitest

- schema 标准化邮箱并拒绝无效 UUID、无效邮箱。
- handler 拒绝非 POST、无认证和无效输入。
- 非 Owner 时管理员服务工厂从未被调用。
- Auth 分页在找到用户时停止，最多读取 10 页且不超过 1000 个用户。
- 未找到、重复成员和内部错误映射为对应状态码。
- CORS 只回显允许来源，拒绝非白名单来源，无 Origin 调用不产生 CORS header。
- Server Actions 覆盖认证、Edge 错误映射、RLS 删除 0 行和成功重新验证。
- UI 覆盖 Owner 控件、普通成员无管理控件、添加字段错误与移除确认文案。
- 权限失效守卫只在成员记录消失时清理 channels 和跳转。

### pgTAP

- Owner 可以删除普通成员。
- 普通成员不能添加或删除成员。
- Owner 记录不能删除或降级。
- 删除普通成员后，其工作区读取与 `private.is_workspace_topic_member` 均返回拒绝。
- 现有 GRANT、RLS 和触发器约束继续成立。

### Playwright

- Alice 按邮箱添加已注册的 Bob。
- 重复添加返回明确提示，未注册邮箱提示先注册。
- Bob 看不到管理控件，直接调用函数得到 403。
- Alice 通过确认框移除 Bob。
- Bob 后续数据操作触发访问守卫并返回工作区总览。
- Bob 重新建立私有工作区频道失败，Alice 仍可正常访问。
- 成员列表始终不显示邮箱。

## 文档与验证

实现完成后同步：

- `README.md`：当前进度、函数启动方式和 `APP_ORIGINS` 配置。
- `docs/DEVELOPMENT.md`：阶段 14 实施状态。
- `docs/TECH.md`：若实现细节需要补充，记录低层认证原语、惰性管理员客户端和 Origin 白名单约定。

最终验证至少包含：

```bash
HOME=/private/tmp/codex-supabase-home pnpm exec supabase db reset
HOME=/private/tmp/codex-supabase-home pnpm exec supabase test db --local
HOME=/private/tmp/codex-supabase-home pnpm exec supabase db advisors --local --type all --level warn --fail-on error
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright test tests/e2e/member-management.spec.ts
```

运行 Playwright 成员管理测试时，按当前 CLI `functions serve --help` 确认命令并启动本地 Edge Functions。

## 完成条件

- `MEMBER-02`、`MEMBER-03`、`EDGE-01` 均有实现入口和自动化验证。
- Owner 权限检查失败时不会创建或调用管理员客户端。
- 函数环境之外不存在 secret/service key。
- 添加、重复、未找到、非 Owner、移除和权限失效均有稳定反馈。
- 被移除成员的后续数据请求与重新建立的 Realtime 频道均被拒绝。
- 改动不包含邀请系统、Owner 转移或阶段 15 功能。
