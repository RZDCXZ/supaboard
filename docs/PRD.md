# SupaBoard 产品需求文档

| 项目 | 内容 |
| --- | --- |
| 文档版本 | 1.0 |
| 文档状态 | 可实施 |
| 产品类型 | Supabase 学习型 Demo |
| 目标读者 | 具备 React + Node.js 全栈经验、初次系统学习 Supabase 的开发者 |
| 前端原则 | 页面最少、样式从简，优先展示 Supabase 能力与安全边界 |

## 1. 产品概述

SupaBoard 是一个极简多人协作任务板。用户可以创建工作区、添加成员、维护任务、发表评论、上传附件，并实时看到其他成员的变更和在线状态。

产品本身不是目标，目标是通过一条完整、可运行、可测试的业务链路，学习 Supabase 的常用能力：

- Postgres 数据库、关系模型和自动生成的 Data API。
- Auth、Next.js SSR Cookie 会话和 GitHub OAuth。
- Row Level Security（RLS）与多租户数据隔离。
- Storage 公共桶、私有桶、直传和签名 URL。
- Realtime Postgres Changes、Presence 和 Broadcast。
- Database Function（RPC）、触发器、视图、迁移、Seed 和类型生成。
- Edge Function、用户 JWT、服务端 secret key 和云端部署。

## 2. 产品目标

### 2.1 核心目标

1. 产出一个能够在本地 Supabase 和托管 Supabase 项目运行的 Next.js Demo。
2. 用同一个业务模型解释浏览器直连 Supabase、服务端访问 Supabase 和 Edge Function 特权访问的差异。
3. 让每项权限都由数据库或 Supabase 服务端能力强制执行，而不是只依赖前端隐藏按钮。
4. 为 RLS、Storage 和 Realtime 权限提供可重复执行的自动化测试。
5. 所有数据库结构均来自可追踪的迁移，并能够生成准确的 TypeScript 类型。

### 2.2 成功指标

- 新开发者可以按本文档七个阶段完成学习，不需要先掌握 Supabase Dashboard 的手工操作。
- 两名测试用户可以在同一工作区协作，第三名非成员无法读取或修改该工作区的数据。
- 刷新页面后登录状态保持，退出后受保护页面不可访问。
- 任务和评论变更能在两个浏览器窗口间实时同步。
- 头像可公开访问，任务附件只能由工作区成员通过短时签名 URL 下载。
- 本地数据库重置后，迁移、Seed、测试和类型生成仍可重复执行。

## 3. 用户角色

| 角色 | 身份 | 核心权限 |
| --- | --- | --- |
| 访客 | 未登录用户 | 注册、登录、发起密码重置、完成 OAuth 回调 |
| 工作区成员 | 已登录且存在成员关系 | 查看工作区和成员、维护任务、发表评论、上传与读取附件、参与实时频道 |
| 工作区 Owner | 创建工作区的用户 | 拥有成员全部权限，另可修改工作区、添加或移除普通成员 |

约束：

- 每个工作区恰好有一个 Owner。
- Owner 不允许通过普通成员管理操作删除自己或降级自己。
- 用户可以属于多个工作区，并在不同工作区拥有不同角色。
- “已登录”不等于“已授权”；所有工作区资源都必须再次检查成员关系。

## 4. 信息架构与页面

| 路由 | 访问条件 | 页面职责 |
| --- | --- | --- |
| `/login` | 访客 | 邮箱密码登录、GitHub OAuth 入口、跳转注册和密码重置 |
| `/signup` | 访客 | 邮箱密码注册及邮箱确认提示 |
| `/forgot-password` | 访客 | 发送密码重置邮件 |
| `/update-password` | 有效恢复会话 | 设置新密码 |
| `/auth/callback` | 公开回调 | 交换 PKCE code，完成邮箱确认或 GitHub OAuth |
| `/app` | 已登录 | 工作区列表、创建工作区、进入最近工作区 |
| `/app/workspaces/[workspaceId]` | 工作区成员 | 任务、评论、成员、附件、在线状态和活动记录 |
| `/app/settings` | 已登录 | 修改昵称、上传头像、退出登录 |

UI 只采用表单、列表、状态筛选和少量反馈组件。任务按状态分组展示，但不实现拖拽看板。

## 5. 功能需求

### 5.1 Auth 与会话

#### AUTH-01 邮箱密码注册

- 用户提交邮箱和密码后创建账号。
- 邮箱确认开启时，页面显示“请检查邮箱”，不将用户误判为已完成登录。
- 确认链接经 `/auth/callback` 完成 code exchange，再进入 `/app`。

#### AUTH-02 登录和受保护路由

- 支持邮箱密码登录。
- `/app/**` 在服务端判断身份；无有效用户时重定向到 `/login`。
- 刷新访问令牌时更新 Cookie，Server Component 与浏览器端共享同一会话。

#### AUTH-03 GitHub OAuth

- 登录页提供 GitHub 登录入口。
- OAuth 回调成功后进入 `/app`。
- 本地与云端 Supabase 分别配置允许的回调地址。

#### AUTH-04 密码恢复

- 用户在 `/forgot-password` 请求恢复邮件。
- 恢复链接建立恢复会话并进入 `/update-password`。
- 密码更新成功后返回 `/app`。

#### AUTH-05 登出

- 用户可从设置页登出。
- 登出后清除会话并返回 `/login`，再次访问 `/app` 会被拒绝。

### 5.2 Profile

#### PROFILE-01 自动创建资料

- Auth 用户创建后，数据库触发器自动写入 `profiles`。
- 初始昵称优先使用 OAuth 提供的名称；没有名称时使用邮箱 `@` 前的部分。

#### PROFILE-02 修改资料和头像

- 用户只能修改自己的昵称和头像路径。
- 头像直接上传到公共 `avatars` 桶，固定使用用户 ID 作为首级目录。
- 再次上传使用 upsert 替换现有头像。

### 5.3 工作区与成员

#### WORKSPACE-01 创建工作区

- 已登录用户输入名称创建工作区。
- `create_workspace(name)` 在一个数据库事务内创建工作区和 Owner 成员记录。
- 创建成功后直接进入工作区页面。

#### WORKSPACE-02 工作区列表

- `/app` 只展示当前用户已加入的工作区。
- 列表显示名称、当前用户角色和更新时间。

#### MEMBER-01 查看成员

- 工作区成员可以查看同一工作区成员的昵称、头像和角色。
- 不展示其他成员的邮箱。

#### MEMBER-02 按邮箱添加成员

- 仅 Owner 可以提交目标邮箱。
- Edge Function 只允许添加已经注册的用户。
- 重复添加返回明确提示，不产生重复记录。
- 未找到用户时提示对方先完成注册；本 Demo 不发送生产级邀请邮件。

#### MEMBER-03 移除成员

- 仅 Owner 可以移除普通成员。
- Owner 不可移除自己。
- 被移除用户后续请求和重新建立的 Realtime 连接均失去权限。

### 5.4 任务

#### TASK-01 创建与查看

- 成员可以创建任务，必填标题，描述可选。
- 任务默认状态为 `todo`、优先级为 `medium`。
- 工作区页面支持按状态和负责人筛选，结果按更新时间倒序。

#### TASK-02 修改

- 成员可以修改标题、描述、状态、优先级和负责人。
- 负责人必须属于同一工作区。
- 状态只允许 `todo`、`in_progress`、`done`。
- 优先级只允许 `low`、`medium`、`high`。

#### TASK-03 删除

- 工作区成员可以删除任务。
- 删除任务同时删除其评论和附件元数据；Storage 对象由应用在删除任务前清理。

#### TASK-04 统计

- 页面通过 `get_workspace_stats(workspace_id)` 显示各状态任务数和总数。
- 统计结果必须遵守调用用户的工作区访问权限。

### 5.5 评论与活动记录

#### COMMENT-01 评论

- 成员可以在任务下发表评论。
- 评论作者可以删除自己的评论；Owner 可以删除工作区内任意评论。
- 评论正文去除首尾空白后长度必须为 1～2000 个字符。

#### ACTIVITY-01 活动记录

- 任务新增、状态变更和删除由数据库触发器写入活动记录。
- 成员可以读取所属工作区的记录。
- 浏览器和普通服务端客户端均不能直接新增、修改或删除活动记录。

### 5.6 Storage

#### STORAGE-01 公共头像

- `avatars` 是公共桶，读取不需要签名 URL。
- 用户只能在 `{自己的用户 ID}/avatar.{扩展名}` 路径上传、替换或删除头像。
- 支持 JPEG、PNG、WebP，单文件不超过 2 MB。

#### STORAGE-02 私有任务附件

- `attachments` 是私有桶。
- 对象路径为 `{workspaceId}/{taskId}/{随机 UUID}-{安全文件名}`。
- 只有工作区成员可以上传和读取附件。
- 上传者或 Owner 可以删除附件。
- 支持常见图片、PDF 和纯文本文件，单文件不超过 10 MB。
- 下载前由服务端生成 60 秒有效的签名 URL。

### 5.7 Realtime

#### REALTIME-01 数据库变更

- `tasks` 和 `comments` 加入 `supabase_realtime` publication。
- 客户端订阅当前工作区相关事件，并在 INSERT、UPDATE、DELETE 后更新本地列表。
- 组件卸载或切换工作区时必须取消订阅。

#### REALTIME-02 在线状态

- 成员加入私有频道 `workspace:{workspaceId}` 后发布 Presence 状态。
- 页面显示当前在线成员，不保存永久在线记录。

#### REALTIME-03 输入状态

- 用户输入评论时通过 Broadcast 发送临时 `typing` 事件。
- 输入状态不写入数据库，停止输入后自动消失。
- 非工作区成员不能加入频道、发送或接收事件。

### 5.8 Edge Function

#### EDGE-01 添加成员

- 函数名为 `add-member-by-email`。
- 请求体为 `{ "workspaceId": "uuid", "email": "member@example.com" }`。
- 请求必须携带当前用户 JWT。
- 函数先用用户身份确认 Owner 权限，再使用仅存在于函数环境的管理员客户端查找目标用户并写入成员关系。
- 状态码约定：`200` 成功、`400` 参数错误、`401` 未登录、`403` 非 Owner、`404` 用户不存在、`409` 已是成员。

## 6. 非功能需求

### 6.1 安全

- 所有暴露到 Data API 的业务表必须启用 RLS。
- 浏览器只接触项目 URL 和 publishable key。
- secret/service key 只能存在于 Edge Function 环境，不能使用 `NEXT_PUBLIC_` 前缀。
- 授权不使用用户可修改的 `user_metadata`。
- 所有数据库 UPDATE policy 同时定义可见旧行的 `USING` 和新行约束 `WITH CHECK`。
- 多租户测试至少包含 Owner、成员和非成员三个身份。

### 6.2 可维护性

- 数据库结构、策略、桶和函数均由迁移创建，不依赖 Dashboard 手工状态。
- Seed 数据不得包含真实凭据。
- 数据库类型由 Supabase CLI 生成，不手写表结构类型。
- 错误提示面向用户，日志保留原始错误但不泄露密钥和敏感字段。

### 6.3 性能边界

- 任务列表默认每页 20 条，最大每页 100 条。
- 常用过滤字段建立索引。
- 本 Demo 以学习和小团队为目标，不把 Postgres Changes 设计为大规模消息系统。

## 7. 明确不做

- 复杂视觉设计、移动端适配专项和独立设计系统。
- 拖拽看板、富文本编辑、全文搜索和通知中心。
- 匿名登录、手机号登录、企业 SSO 和多因素认证。
- 未注册用户邀请和生产级邮件投递。
- 计费、订阅、AI、Embedding、pgvector、Cron、Queues 和 Database Webhooks。
- Next.js 生产部署、域名配置和完整 CI/CD。

## 8. 学习实施阶段

| 阶段 | 操作任务 | 预期结果 | Supabase 知识点 |
| --- | --- | --- | --- |
| 1. 本地环境 | 初始化 Next.js；安装并检查 CLI；执行 `supabase init/start`；创建首个迁移与 Seed；执行数据库重置 | Studio、本地 API、Auth、Storage 可访问；重置后 schema 和示例数据可恢复 | CLI、Docker 本地栈、`config.toml`、migration、seed、环境变量 |
| 2. Auth 与 SSR | 建立 browser/server client；实现 Cookie 刷新层；完成注册、登录、确认、恢复、登出和受保护路由 | 刷新保持登录；无效会话不能进入 `/app`；本地邮件可从 Mailpit 验证 | Auth、PKCE、SSR Cookie、publishable key、Server Component |
| 3. Database API | 建表和约束；生成 TS 类型；实现工作区、任务、评论 CRUD；加入关联查询、筛选分页、RPC、视图和触发器 | 页面可完成主要业务操作；类型来自真实 schema；统计和日志正确 | PostgREST/Data API、关系查询、RPC、trigger、view、index、typegen |
| 4. RLS | 为每张表建立策略；准备 Owner、成员、非成员；编写并执行 pgTAP 权限测试 | 所有跨租户访问被数据库拒绝；合法成员流程不被误伤 | `auth.uid()`、`TO authenticated`、`USING`、`WITH CHECK`、BOLA/IDOR |
| 5. Storage | 迁移创建公共/私有桶；实现头像 upsert、附件上传、元数据和签名 URL；测试越权 | 头像可公开显示；私有附件只有成员可访问；越权测试失败 | `storage.objects` RLS、bucket、object path、upsert、signed URL |
| 6. Realtime | 发布任务和评论表；订阅 Postgres Changes；建立私有 Presence/Broadcast 频道及授权 | 两个浏览器同步任务和评论；显示在线成员和输入状态；非成员无法连接 | publication、channel、Postgres Changes、Presence、Broadcast、Realtime Authorization |
| 7. Edge 与云端 | 实现并测试添加成员函数；登录并 link 云项目；推送迁移、部署函数、配置 GitHub OAuth；生成远端类型；运行 advisors | 本地功能在云端项目复现；OAuth 和 Edge Function 可用；类型一致且无未处理安全告警 | Edge Runtime、JWT、secret key、deploy、remote migration、advisors |

## 9. 验收场景

### 9.1 主流程

1. Alice 注册并确认邮箱，创建工作区 Alpha。
2. Bob 注册后，Alice 通过邮箱将 Bob 添加为成员。
3. Bob 创建任务并上传附件，Alice 的页面无需刷新即可看到任务。
4. Alice 修改任务状态并评论，Bob 的页面实时更新并显示输入状态。
5. Bob 可以下载附件，但无法修改成员列表。
6. 未加入 Alpha 的 Charlie 无法读取 Alpha 的工作区、任务、评论、附件和 Realtime 频道。
7. Alice 移除 Bob 后，Bob 后续的数据请求被拒绝；重新连接 Realtime 时无法加入频道。

### 9.2 Definition of Done

- 七个阶段的功能与测试全部可在干净的本地数据库复现。
- RLS、Storage 和 Realtime 授权测试通过。
- Vitest 覆盖输入验证和错误映射，Playwright 覆盖主流程与双窗口实时同步。
- 云端项目完成迁移、函数部署和 GitHub OAuth 验证。
- 数据库安全与性能 advisors 没有未解释的高优先级问题。
- `PRD.md` 中每项功能均能在 `TECH.md` 找到对应实现边界和测试策略。
