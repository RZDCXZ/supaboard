# Stage 14 Edge Member Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Owner-only member addition by registered email and removal of ordinary members, with a JWT-protected Edge Function, explicit CORS allowlist, RLS-backed removal, revoked-access cleanup, and automated tests.

**Architecture:** The Edge Function uses `@supabase/server/core` primitives to verify the user JWT and create an RLS-scoped client, proves the caller is the workspace Owner, and only then lazily creates the admin client for Auth lookup and membership insertion. Next.js Server Actions remain the application entrypoint; small client dialogs render member controls, while a workspace access guard verifies suspected membership loss before clearing Realtime state and navigating away.

**Tech Stack:** Supabase CLI 2.109.0, `@supabase/server` 1.3.0, `@supabase/functions-js` 2.110.2, `@supabase/supabase-js` 2.110.0, Zod 4.4.3, Next.js 16.2.10, React 19.2.4, Vitest 4.1.9, Playwright 1.61.1, pgTAP.

## Global Constraints

- Scope is limited to `MEMBER-02`, `MEMBER-03`, and `EDGE-01`; do not implement invitations, role editing, Owner transfer, or stage 15 work.
- Keep `[functions.add-member-by-email].verify_jwt = true`.
- The RLS-scoped client must prove Owner membership before `createAdminClient()` is called.
- Admin Auth scanning is exactly 100 users per page, at most 10 pages and 1000 users.
- `APP_ORIGINS` is a comma-separated explicit allowlist; local defaults are `http://localhost:3000` and `http://127.0.0.1:3000`.
- Requests without an `Origin` header may continue to JWT authentication for Server Actions and CLI tests; browser origins outside the allowlist are rejected before business logic.
- Never log or return Authorization, apikey, secret/service keys, full request bodies, or Auth user lists.
- Do not add a migration unless a failing database test proves the existing RLS or Owner-protection contract is insufficient.
- Follow red-green-refactor for every behavior change and keep each commit scoped to one task.

## File Map

- `supabase/functions/add-member-by-email/schema.ts`: normalized Edge request schema.
- `supabase/functions/add-member-by-email/handler.ts`: pure HTTP orchestration, pagination, stable errors, and testable CORS helpers.
- `supabase/functions/add-member-by-email/index.ts`: runtime auth, RLS client, lazy admin client, and Supabase SDK adapters.
- `supabase/functions/add-member-by-email/deno.json`: pinned Edge imports.
- `supabase/config.toml`: JWT-protected function registration.
- `src/features/members/validation.ts`: Server Action input schemas and field errors.
- `src/features/members/actions.ts`: add-via-Edge and remove-via-RLS actions.
- `src/features/members/add-member-dialog.tsx`: Owner add-member form.
- `src/features/members/remove-member-dialog.tsx`: dangerous removal confirmation.
- `src/features/members/member-list.tsx`: conditional Owner controls without exposing email.
- `src/features/workspaces/use-workspace-access-guard.ts`: membership recheck and revoked-access cleanup.
- `src/features/realtime/use-workspace-changes.ts`: signals private-channel authorization failures.
- `src/features/tasks/task-workspace.tsx`, `create-task-dialog.tsx`, `task-drawer.tsx`, `src/features/comments/comment-section.tsx`, `src/features/storage/attachments/attachment-section.tsx`: report `FORBIDDEN` results to the access guard.
- `src/app/app/page.tsx`: deterministic membership-removed notice.
- `src/app/app/workspaces/[workspaceId]/page.tsx`: Owner-only member management entrypoints.
- `supabase/tests/database/members.test.sql`: RLS and Realtime authorization after removal.
- `tests/unit/member-edge-handler.test.ts`, `member-actions.test.ts`, `member-management.test.tsx`, `workspace-access-guard.test.tsx`: focused unit coverage.
- `tests/e2e/fixtures/auth.ts`, `tests/e2e/member-management.spec.ts`: reproducible browser flow.
- `README.md`, `docs/TECH.md`, `docs/DEVELOPMENT.md`: runtime usage and stage status.

---

### Task 1: Edge request contract and lazy-admin orchestration

**Files:**
- Create: `supabase/functions/add-member-by-email/schema.ts`
- Create: `supabase/functions/add-member-by-email/handler.ts`
- Create: `tests/unit/member-edge-handler.test.ts`

**Interfaces:**
- Consumes: standard `Request`/`Response`, Zod 4.4.3.
- Produces: `handleAddMemberRequest(request, services): Promise<Response>`, `AddMemberServices`, `AdminMemberServices`, `parseAllowedOrigins(value)`, `corsHeadersForOrigin(origin, allowedOrigins)`, and `withCors(response, origin, allowedOrigins)`.

- [ ] **Step 1: Generate the official user-authenticated function scaffold**

Run before creating custom handler files:

```bash
HOME=/private/tmp/codex-supabase-home pnpm exec supabase functions new add-member-by-email --auth user
```

Expected: the CLI creates `supabase/functions/add-member-by-email/index.ts`, `deno.json`, and the matching `supabase/config.toml` block. Generated setup is the approved scaffold exception; no custom member-management behavior exists yet.

- [ ] **Step 2: Write the failing schema and handler tests**

Create `tests/unit/member-edge-handler.test.ts` with real `Request` objects and injected services:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  corsHeadersForOrigin,
  handleAddMemberRequest,
  parseAllowedOrigins,
  type AddMemberServices,
} from "../../supabase/functions/add-member-by-email/handler";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const callerId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";

function post(body: unknown) {
  return new Request("http://localhost/functions/v1/add-member-by-email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function services(overrides: Partial<AddMemberServices> = {}): AddMemberServices {
  return {
    callerId,
    requestId: "request-1",
    checkOwner: vi.fn().mockResolvedValue(true),
    createAdminServices: vi.fn(() => ({
      listUsers: vi.fn().mockResolvedValue({
        users: [{ id: memberId, email: "bob@example.com" }],
        failed: false,
      }),
      insertMember: vi.fn().mockResolvedValue("inserted"),
    })),
    logFailure: vi.fn(),
    ...overrides,
  };
}

describe("add-member-by-email handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes email and returns the inserted member", async () => {
    const current = services();
    const response = await handleAddMemberRequest(
      post({ workspaceId, email: "  BOB@EXAMPLE.COM " }),
      current,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      member: { userId: memberId, role: "member" },
    });
    expect(current.checkOwner).toHaveBeenCalledWith(workspaceId);
    expect(current.createAdminServices).toHaveBeenCalledOnce();
  });

  it("never creates admin services when Owner authorization fails", async () => {
    const createAdminServices = vi.fn();
    const response = await handleAddMemberRequest(
      post({ workspaceId, email: "bob@example.com" }),
      services({
        checkOwner: vi.fn().mockResolvedValue(false),
        createAdminServices,
      }),
    );

    expect(response.status).toBe(403);
    expect(createAdminServices).not.toHaveBeenCalled();
  });

  it("scans at most ten pages and returns 404 when no email matches", async () => {
    const listUsers = vi.fn().mockResolvedValue({
      users: Array.from({ length: 100 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        email: `user-${index}@example.com`,
      })),
      failed: false,
    });
    const insertMember = vi.fn();
    const response = await handleAddMemberRequest(
      post({ workspaceId, email: "missing@example.com" }),
      services({
        createAdminServices: vi.fn(() => ({ listUsers, insertMember })),
      }),
    );

    expect(response.status).toBe(404);
    expect(listUsers).toHaveBeenCalledTimes(10);
    expect(listUsers).toHaveBeenLastCalledWith(10, 100);
    expect(insertMember).not.toHaveBeenCalled();
  });

  it("maps a duplicate membership to 409", async () => {
    const response = await handleAddMemberRequest(
      post({ workspaceId, email: "bob@example.com" }),
      services({
        createAdminServices: vi.fn(() => ({
          listUsers: vi.fn().mockResolvedValue({
            users: [{ id: memberId, email: "bob@example.com" }],
            failed: false,
          }),
          insertMember: vi.fn().mockResolvedValue("duplicate"),
        })),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "MEMBER_ALREADY_EXISTS", requestId: "request-1" },
    });
  });

  it.each([
    [new Request("http://localhost", { method: "GET" }), services(), 405, "METHOD_NOT_ALLOWED"],
    [post({ workspaceId, email: "bob@example.com" }), services({ callerId: null }), 401, "NOT_AUTHENTICATED"],
    [post({ workspaceId: "bad-id", email: "bad-email" }), services(), 400, "VALIDATION_ERROR"],
  ] as const)("maps request contract failures", async (request, current, status, code) => {
    const response = await handleAddMemberRequest(request, current);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });

  it("stops Auth pagination as soon as a later page matches", async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({
        users: Array.from({ length: 100 }, (_, index) => ({
          id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          email: `first-${index}@example.com`,
        })),
        failed: false,
      })
      .mockResolvedValueOnce({
        users: [{ id: memberId, email: "bob@example.com" }],
        failed: false,
      });
    const response = await handleAddMemberRequest(
      post({ workspaceId, email: "bob@example.com" }),
      services({
        createAdminServices: vi.fn(() => ({
          listUsers,
          insertMember: vi.fn().mockResolvedValue("inserted"),
        })),
      }),
    );
    expect(response.status).toBe(200);
    expect(listUsers).toHaveBeenCalledTimes(2);
  });

  it("maps owner lookup, Auth listing, and insert failures to sanitized 500 responses", async () => {
    const ownerFailure = services({ checkOwner: vi.fn().mockResolvedValue(null) });
    const ownerResponse = await handleAddMemberRequest(
      post({ workspaceId, email: "bob@example.com" }),
      ownerFailure,
    );
    expect(ownerResponse.status).toBe(500);
    expect(ownerFailure.logFailure).toHaveBeenCalledWith("owner");

    const listFailure = services({
      createAdminServices: vi.fn(() => ({
        listUsers: vi.fn().mockResolvedValue({ users: [], failed: true }),
        insertMember: vi.fn(),
      })),
    });
    const listResponse = await handleAddMemberRequest(
      post({ workspaceId, email: "bob@example.com" }),
      listFailure,
    );
    expect(listResponse.status).toBe(500);
    expect(listFailure.logFailure).toHaveBeenCalledWith("auth-list");

    const insertFailure = services({
      createAdminServices: vi.fn(() => ({
        listUsers: vi.fn().mockResolvedValue({
          users: [{ id: memberId, email: "bob@example.com" }],
          failed: false,
        }),
        insertMember: vi.fn().mockResolvedValue("failed"),
      })),
    });
    const insertResponse = await handleAddMemberRequest(
      post({ workspaceId, email: "bob@example.com" }),
      insertFailure,
    );
    expect(insertResponse.status).toBe(500);
    expect(insertFailure.logFailure).toHaveBeenCalledWith("insert");
  });

  it("uses explicit local origins when APP_ORIGINS is empty", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
    expect(
      corsHeadersForOrigin("http://localhost:3000", parseAllowedOrigins(undefined)),
    ).toMatchObject({
      "Access-Control-Allow-Origin": "http://localhost:3000",
      Vary: "Origin",
    });
    expect(
      corsHeadersForOrigin("https://evil.example", parseAllowedOrigins(undefined)),
    ).toBeNull();
  });
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `pnpm exec vitest run tests/unit/member-edge-handler.test.ts`

Expected: the test suite is red because the custom `schema.ts`, `handler.ts`, and exported interfaces are absent; the failure must point only to that missing contract, not an unrelated configuration problem.

- [ ] **Step 4: Implement the normalized schema**

Create `supabase/functions/add-member-by-email/schema.ts`:

```ts
import { z } from "zod";

export const addMemberRequestSchema = z
  .object({
    workspaceId: z.string().uuid(),
    email: z
      .string()
      .trim()
      .email()
      .transform((value) => value.toLowerCase()),
  })
  .strict();

export type AddMemberRequestInput = z.infer<typeof addMemberRequestSchema>;
```

- [ ] **Step 5: Implement the pure handler and CORS helpers**

Create `supabase/functions/add-member-by-email/handler.ts` with these exact public contracts and control flow:

```ts
import { addMemberRequestSchema, type AddMemberRequestInput } from "./schema";

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const LOCAL_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

type ListedUser = { id: string; email: string | null };
type InsertMemberResult = "inserted" | "duplicate" | "failed";

export type AdminMemberServices = {
  listUsers: (
    page: number,
    perPage: number,
  ) => Promise<{ users: readonly ListedUser[]; failed: boolean }>;
  insertMember: (
    input: AddMemberRequestInput & { userId: string; addedBy: string },
  ) => Promise<InsertMemberResult>;
};

export type AddMemberServices = {
  callerId: string | null;
  requestId: string;
  checkOwner: (workspaceId: string) => Promise<boolean | null>;
  createAdminServices: () => AdminMemberServices;
  logFailure: (stage: "owner" | "auth-list" | "insert" | "runtime") => void;
};

type ErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "VALIDATION_ERROR"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "USER_NOT_FOUND"
  | "MEMBER_ALREADY_EXISTS"
  | "INTERNAL_ERROR";

function errorResponse(status: number, code: ErrorCode, message: string, requestId: string) {
  return Response.json({ error: { code, message, requestId } }, { status });
}

export function parseAllowedOrigins(value: string | undefined) {
  const configured = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured && configured.length > 0 ? [...new Set(configured)] : LOCAL_ORIGINS;
}

export function corsHeadersForOrigin(origin: string | null, allowedOrigins: readonly string[]) {
  if (!origin || !allowedOrigins.includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  } as const;
}

export function withCors(response: Response, origin: string | null, allowedOrigins: readonly string[]) {
  const cors = corsHeadersForOrigin(origin, allowedOrigins);
  if (!cors) return response;
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([name, value]) => headers.set(name, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function handleAddMemberRequest(request: Request, services: AddMemberServices) {
  if (request.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "仅支持 POST 请求", services.requestId);
  }
  if (!services.callerId) {
    return errorResponse(401, "NOT_AUTHENTICATED", "请先登录后再添加成员", services.requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "请求参数不正确", services.requestId);
  }
  const parsed = addMemberRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "请求参数不正确", services.requestId);
  }

  try {
    const isOwner = await services.checkOwner(parsed.data.workspaceId);
    if (isOwner === null) {
      services.logFailure("owner");
      return errorResponse(500, "INTERNAL_ERROR", "暂时无法添加成员，请稍后重试", services.requestId);
    }
    if (!isOwner) {
      return errorResponse(403, "FORBIDDEN", "只有工作区 Owner 可以添加成员", services.requestId);
    }

    const admin = services.createAdminServices();
    let userId: string | null = null;
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await admin.listUsers(page, PAGE_SIZE);
      if (result.failed) {
        services.logFailure("auth-list");
        return errorResponse(500, "INTERNAL_ERROR", "暂时无法添加成员，请稍后重试", services.requestId);
      }
      userId = result.users.find(
        (user) => user.email?.trim().toLowerCase() === parsed.data.email,
      )?.id ?? null;
      if (userId || result.users.length < PAGE_SIZE) break;
    }

    if (!userId) {
      return errorResponse(404, "USER_NOT_FOUND", "未找到该用户，请让对方先完成注册", services.requestId);
    }

    const insertResult = await admin.insertMember({
      ...parsed.data,
      userId,
      addedBy: services.callerId,
    });
    if (insertResult === "duplicate") {
      return errorResponse(409, "MEMBER_ALREADY_EXISTS", "该用户已经是工作区成员", services.requestId);
    }
    if (insertResult === "failed") {
      services.logFailure("insert");
      return errorResponse(500, "INTERNAL_ERROR", "暂时无法添加成员，请稍后重试", services.requestId);
    }

    return Response.json({ member: { userId, role: "member" as const } });
  } catch {
    services.logFailure("runtime");
    return errorResponse(500, "INTERNAL_ERROR", "暂时无法添加成员，请稍后重试", services.requestId);
  }
}
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run: `pnpm exec vitest run tests/unit/member-edge-handler.test.ts`

Expected: PASS, including proof that `createAdminServices` is never called for a non-Owner.

- [ ] **Step 7: Commit the handler contract**

```bash
git add supabase/functions/add-member-by-email supabase/config.toml tests/unit/member-edge-handler.test.ts
git commit -m "feat(edge): add member handler contract"
```

---

### Task 2: Edge runtime, JWT verification, CORS, and pinned imports

**Files:**
- Create with official CLI, then modify: `supabase/functions/add-member-by-email/index.ts`
- Create with official CLI, then modify: `supabase/functions/add-member-by-email/deno.json`
- Modify: `supabase/config.toml:416`

**Interfaces:**
- Consumes: Task 1 `handleAddMemberRequest`, `parseAllowedOrigins`, `corsHeadersForOrigin`, `withCors`.
- Produces: POST `/functions/v1/add-member-by-email`, `verify_jwt = true`, exact Origin responses, RLS Owner check, and lazy `createAdminClient<Database>()`.

- [ ] **Step 1: Pin the scaffolded Edge imports**

Set `supabase/functions/add-member-by-email/deno.json` to:

```json
{
  "imports": {
    "@supabase/functions-js": "jsr:@supabase/functions-js@2.110.2",
    "@supabase/server": "npm:@supabase/server@1.3.0",
    "zod": "npm:zod@4.4.3"
  }
}
```

- [ ] **Step 2: Implement the runtime adapter**

Set `supabase/functions/add-member-by-email/index.ts` to:

```ts
import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  createContextClient,
  verifyAuth,
} from "@supabase/server/core";

import type { Database } from "../../../src/types/database.ts";
import {
  corsHeadersForOrigin,
  handleAddMemberRequest,
  parseAllowedOrigins,
  withCors,
} from "./handler.ts";

const allowedOrigins = parseAllowedOrigins(Deno.env.get("APP_ORIGINS"));

export default {
  async fetch(request: Request) {
    const origin = request.headers.get("origin");
    const cors = corsHeadersForOrigin(origin, allowedOrigins);

    if (request.method === "OPTIONS") {
      if (!cors) {
        return Response.json(
          {
            error: {
              code: "ORIGIN_NOT_ALLOWED",
              message: "请求来源不被允许",
              requestId: crypto.randomUUID(),
            },
          },
          { status: 403 },
        );
      }
      return new Response(null, { status: 204, headers: cors });
    }
    if (origin && !cors) {
      return Response.json(
        {
          error: {
            code: "ORIGIN_NOT_ALLOWED",
            message: "请求来源不被允许",
            requestId: crypto.randomUUID(),
          },
        },
        { status: 403 },
      );
    }
    const requestId = crypto.randomUUID();
    const { data: auth, error: authError } = await verifyAuth(request, {
      auth: "user",
    });
    if (authError || !auth) {
      return withCors(
        Response.json(
          {
            error: {
              code: "NOT_AUTHENTICATED",
              message: "请先登录后再添加成员",
              requestId,
            },
          },
          { status: 401 },
        ),
        origin,
        allowedOrigins,
      );
    }

    const callerId = auth.userClaims?.id ?? null;
    const userClient = createContextClient<Database>({
      auth: { token: auth.token, keyName: auth.keyName },
    });
    const response = await handleAddMemberRequest(request, {
      callerId,
      requestId,
      checkOwner: async (workspaceId) => {
        if (!callerId) return false;
        const { data, error } = await userClient
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", callerId)
          .eq("role", "owner")
          .maybeSingle();
        return error ? null : Boolean(data);
      },
      createAdminServices: () => {
        const admin = createAdminClient<Database>();
        return {
          listUsers: async (page, perPage) => {
            const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
            return {
              users: (data?.users ?? []).map(({ id, email }) => ({ id, email: email ?? null })),
              failed: Boolean(error),
            };
          },
          insertMember: async ({ workspaceId, userId, addedBy }) => {
            const { error } = await admin.from("workspace_members").insert({
              workspace_id: workspaceId,
              user_id: userId,
              role: "member",
              added_by: addedBy,
            });
            if (!error) return "inserted";
            if (error.code === "23505") return "duplicate";
            return "failed";
          },
        };
      },
      logFailure: (stage) => {
        console.error("add-member-by-email failed", { requestId, stage });
      },
    });

    return withCors(response, origin, allowedOrigins);
  },
};
```

- [ ] **Step 3: Confirm the function configuration**

Ensure `supabase/config.toml` contains:

```toml
[functions.add-member-by-email]
enabled = true
verify_jwt = true
import_map = "./functions/add-member-by-email/deno.json"
entrypoint = "./functions/add-member-by-email/index.ts"
```

- [ ] **Step 4: Verify CLI shape, unit tests, and local bundling**

Run:

```bash
HOME=/private/tmp/codex-supabase-home pnpm exec supabase functions serve --help
pnpm exec vitest run tests/unit/member-edge-handler.test.ts
```

Expected: help shows `serve` manages all local functions; the focused tests pass.

Start the function runtime in a separate terminal:

```bash
APP_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 HOME=/private/tmp/codex-supabase-home pnpm exec supabase functions serve
```

Then verify preflight:

```bash
curl -i -X OPTIONS http://127.0.0.1:54321/functions/v1/add-member-by-email \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST'
```

Expected: HTTP 204 and `Access-Control-Allow-Origin: http://localhost:3000`. Runtime output contains no bundling or import error.

- [ ] **Step 5: Commit the runtime adapter**

```bash
git add supabase/functions/add-member-by-email supabase/config.toml
git commit -m "feat(edge): add member function runtime"
```

---

### Task 3: Member validation and Server Actions

**Files:**
- Create: `src/features/members/validation.ts`
- Create: `src/features/members/actions.ts`
- Modify: `src/features/members/types.ts`
- Create: `tests/unit/member-actions.test.ts`

**Interfaces:**
- Consumes: Edge response `{ member: { userId: string; role: "member" } }` and stable Edge error envelope.
- Produces: `addMemberByEmail(input): Promise<MemberActionResult<AddedMember>>` and `removeWorkspaceMember(input): Promise<MemberActionResult<string>>`.

- [ ] **Step 1: Write failing Server Action tests**

Create `tests/unit/member-actions.test.ts` with hoisted mocks for `createClient`, `revalidatePath`, `functions.invoke`, and the RLS delete chain. Cover these exact assertions:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addMemberByEmail, removeWorkspaceMember } from "@/features/members/actions";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  invoke: vi.fn(),
  remove: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  revalidatePath: vi.fn(),
}));

const builder = {
  delete: mocks.remove,
  eq: mocks.eq,
  select: mocks.select,
  maybeSingle: mocks.maybeSingle,
};
mocks.remove.mockReturnValue(builder);
mocks.eq.mockReturnValue(builder);
mocks.select.mockReturnValue(builder);

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    functions: { invoke: mocks.invoke },
    from: vi.fn(() => builder),
  })),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.remove.mockReturnValue(builder);
  mocks.eq.mockReturnValue(builder);
  mocks.select.mockReturnValue(builder);
});

it("validates email before invoking the Edge Function", async () => {
  const result = await addMemberByEmail({ workspaceId, email: "not-an-email" });
  expect(result).toMatchObject({
    ok: false,
    error: { code: "VALIDATION_ERROR", fields: { email: "请输入有效的邮箱地址" } },
  });
  expect(mocks.invoke).not.toHaveBeenCalled();
});

it("maps USER_NOT_FOUND and MEMBER_ALREADY_EXISTS from Edge responses", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: ownerId } }, error: null });
  for (const code of ["USER_NOT_FOUND", "MEMBER_ALREADY_EXISTS"] as const) {
    mocks.invoke.mockResolvedValueOnce({
      data: null,
      error: {
        context: Response.json(
          { error: { code, requestId: "request-1" } },
          { status: code === "USER_NOT_FOUND" ? 404 : 409 },
        ),
      },
    });
    const result = await addMemberByEmail({ workspaceId, email: "bob@example.com" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  }
});

it("removes only an ordinary member through the user client", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: ownerId } }, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: { user_id: memberId }, error: null });
  await expect(removeWorkspaceMember({ workspaceId, memberId })).resolves.toEqual({
    ok: true,
    data: memberId,
  });
  expect(mocks.eq).toHaveBeenCalledWith("role", "member");
  expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/workspaces/${workspaceId}`);
});
```

- [ ] **Step 2: Run the action test and verify RED**

Run: `pnpm exec vitest run tests/unit/member-actions.test.ts`

Expected: FAIL because the validation, result types, and actions do not exist.

- [ ] **Step 3: Add member management types and validation**

Append to `src/features/members/types.ts`:

```ts
export type MemberActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "USER_NOT_FOUND"
  | "MEMBER_ALREADY_EXISTS"
  | "INTERNAL_ERROR";

export type MemberActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: MemberActionErrorCode;
        message: string;
        fields?: Partial<Record<"email", string>>;
      };
    };

export type AddedMember = { userId: string; role: "member" };
```

Create `src/features/members/validation.ts`:

```ts
import { z } from "zod";

const workspaceIdSchema = z.string().uuid();

export const addMemberInputSchema = z.object({
  workspaceId: workspaceIdSchema,
  email: z.string().trim().email("请输入有效的邮箱地址").transform((value) => value.toLowerCase()),
});

export const removeMemberInputSchema = z.object({
  workspaceId: workspaceIdSchema,
  memberId: z.string().uuid(),
});

export function getMemberFieldErrors(error: z.ZodError) {
  const email = error.flatten().fieldErrors.email?.[0];
  return email ? { email } : undefined;
}
```

- [ ] **Step 4: Implement the two Server Actions**

Create `src/features/members/actions.ts` using the existing task action pattern:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import type { AddedMember, MemberActionErrorCode, MemberActionResult } from "./types";
import { addMemberInputSchema, getMemberFieldErrors, removeMemberInputSchema } from "./validation";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : { supabase, user };
}

function failure<T>(code: MemberActionErrorCode, message: string): MemberActionResult<T> {
  return { ok: false, error: { code, message } };
}

async function edgeFailure(error: unknown): Promise<MemberActionResult<never>> {
  const context = typeof error === "object" && error && "context" in error ? error.context : null;
  let payload: { error?: { code?: MemberActionErrorCode; requestId?: string } } | null = null;
  if (context instanceof Response) {
    try { payload = await context.json(); } catch { payload = null; }
  }
  const code = payload?.error?.code;
  if (code === "FORBIDDEN") return failure(code, "只有工作区 Owner 可以添加成员");
  if (code === "USER_NOT_FOUND") return failure(code, "未找到该用户，请让对方先完成注册");
  if (code === "MEMBER_ALREADY_EXISTS") return failure(code, "该用户已经是工作区成员");
  if (code === "NOT_AUTHENTICATED") return failure(code, "请先登录后再添加成员");
  console.error("add-member-by-email Edge Function failed", { code, requestId: payload?.error?.requestId });
  return failure("INTERNAL_ERROR", "暂时无法添加成员，请稍后重试");
}

export async function addMemberByEmail(input: unknown): Promise<MemberActionResult<AddedMember>> {
  const parsed = addMemberInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "请检查邮箱后重试", fields: getMemberFieldErrors(parsed.error) } };
  }
  const authenticated = await authenticatedClient();
  if (!authenticated) return failure("NOT_AUTHENTICATED", "请先登录后再添加成员");
  const { data, error } = await authenticated.supabase.functions.invoke("add-member-by-email", { body: parsed.data });
  if (error) return edgeFailure(error);
  if (!data?.member || data.member.role !== "member" || typeof data.member.userId !== "string") return edgeFailure(null);
  revalidatePath(`/app/workspaces/${parsed.data.workspaceId}`);
  return { ok: true, data: data.member as AddedMember };
}

export async function removeWorkspaceMember(input: unknown): Promise<MemberActionResult<string>> {
  const parsed = removeMemberInputSchema.safeParse(input);
  if (!parsed.success) return failure("VALIDATION_ERROR", "成员参数不正确");
  const authenticated = await authenticatedClient();
  if (!authenticated) return failure("NOT_AUTHENTICATED", "请先登录后再移除成员");
  const { data, error } = await authenticated.supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", parsed.data.memberId)
    .eq("role", "member")
    .select("user_id")
    .maybeSingle();
  if (error || !data) return failure("FORBIDDEN", "该成员不存在或你没有权限移除");
  revalidatePath(`/app/workspaces/${parsed.data.workspaceId}`);
  return { ok: true, data: data.user_id };
}
```

- [ ] **Step 5: Run the member action tests and full unit suite**

Run:

```bash
pnpm exec vitest run tests/unit/member-actions.test.ts
pnpm test
```

Expected: focused tests and the existing unit suite pass.

- [ ] **Step 6: Commit member actions**

```bash
git add src/features/members tests/unit/member-actions.test.ts
git commit -m "feat(members): add management actions"
```

---

### Task 4: Owner-only member management UI

**Files:**
- Create: `src/features/members/add-member-dialog.tsx`
- Create: `src/features/members/remove-member-dialog.tsx`
- Modify: `src/features/members/member-list.tsx:23`
- Modify: `src/app/app/workspaces/[workspaceId]/page.tsx:91`
- Create: `tests/unit/member-management.test.tsx`
- Modify: `tests/unit/member-list.test.tsx:23`

**Interfaces:**
- Consumes: Task 3 actions and `WorkspaceMember`.
- Produces: `AddMemberDialog({ workspaceId })`, `RemoveMemberDialog({ workspaceId, member })`, and `MemberList({ workspaceId, canManage, members, error, retryHref })`.

- [ ] **Step 1: Write failing component tests**

Create `tests/unit/member-management.test.tsx` and mock the two Server Actions. Assert:

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { AddMemberDialog } from "@/features/members/add-member-dialog";
import { RemoveMemberDialog } from "@/features/members/remove-member-dialog";
import type { WorkspaceMember } from "@/features/members/types";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const bobId = "33333333-3333-4333-8333-333333333333";
const bob: WorkspaceMember = {
  id: bobId,
  displayName: "Bob",
  avatarUrl: null,
  role: "member",
  joinedAt: "2026-07-11T00:00:00Z",
};

const mocks = vi.hoisted(() => ({
  addMemberByEmail: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/members/actions", () => ({
  addMemberByEmail: mocks.addMemberByEmail,
  removeWorkspaceMember: mocks.removeWorkspaceMember,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

beforeEach(() => vi.clearAllMocks());

test("Owner add dialog submits a normalized email and refreshes", async () => {
  mocks.addMemberByEmail.mockResolvedValue({ ok: true, data: { userId: bobId, role: "member" } });
  render(<AddMemberDialog workspaceId={workspaceId} />);
  fireEvent.click(screen.getByRole("button", { name: "添加成员" }));
  fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "  BOB@EXAMPLE.COM " } });
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "添加" }));
  await waitFor(() => expect(mocks.addMemberByEmail).toHaveBeenCalledWith({ workspaceId, email: "  BOB@EXAMPLE.COM " }));
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

test("removal requires explicit dangerous confirmation", async () => {
  mocks.removeWorkspaceMember.mockResolvedValue({ ok: true, data: bobId });
  render(<RemoveMemberDialog workspaceId={workspaceId} member={bob} />);
  fireEvent.click(screen.getByRole("button", { name: "移除 Bob" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("后续请求和重新连接将失去权限");
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "确认移除" }));
  await waitFor(() => expect(mocks.removeWorkspaceMember).toHaveBeenCalledWith({ workspaceId, memberId: bobId }));
});
```

Extend `tests/unit/member-list.test.tsx` so `canManage={false}` has no controls, while `canManage` renders one “移除 Bob” button and no Owner removal button.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `pnpm exec vitest run tests/unit/member-management.test.tsx tests/unit/member-list.test.tsx`

Expected: FAIL because the dialogs and management props do not exist.

- [ ] **Step 3: Implement the add dialog**

Create `src/features/members/add-member-dialog.tsx` following the existing 440px dialog pattern. The submit branch must be:

```tsx
const result = await addMemberByEmail({ workspaceId, email: form.get("email") });
if (!result.ok) {
  setError(result.error);
  if (result.error.fields?.email) inputRef.current?.focus();
  return;
}
setOpen(false);
setError(null);
router.refresh();
toast.success("成员已添加");
```

Render a required `type="email"` field labelled “邮箱”, inline field errors, an `InlineAlert` for action errors, disabled close behavior while pending, and “取消”/“添加” actions.

- [ ] **Step 4: Implement the removal confirmation**

Create `src/features/members/remove-member-dialog.tsx` with an outline destructive trigger named `移除 ${member.displayName}`. The confirmation description must include the member name and “移除后，对方的后续请求和重新连接将失去权限。” On success close, `router.refresh()`, and show `toast.success("成员已移除")`; on failure keep the dialog open and render the stable action message.

- [ ] **Step 5: Add conditional controls to the member list and page**

Change `MemberList` props to include `workspaceId: string` and `canManage?: boolean`. In each ordinary member row render:

```tsx
{canManage && member.role === "member" ? (
  <RemoveMemberDialog workspaceId={workspaceId} member={member} />
) : null}
```

In the member-tab branch of `WorkspacePage`, prepend `<AddMemberDialog workspaceId={workspaceId} />` to PageHeader actions only when `workspace.role === "owner"`, and pass `workspaceId` plus `canManage={workspace.role === "owner"}` to `MemberList`.

- [ ] **Step 6: Run focused UI tests and the full unit suite**

Run:

```bash
pnpm exec vitest run tests/unit/member-management.test.tsx tests/unit/member-list.test.tsx
pnpm test
```

Expected: Owner controls pass; ordinary members still see public member data without email or management controls.

- [ ] **Step 7: Commit Owner UI controls**

```bash
git add src/features/members src/app/app/workspaces/'[workspaceId]'/page.tsx tests/unit/member-management.test.tsx tests/unit/member-list.test.tsx
git commit -m "feat(members): add owner controls"
```

---

### Task 5: Revoked membership guard and Realtime cleanup

**Files:**
- Create: `src/features/workspaces/use-workspace-access-guard.ts`
- Modify: `src/features/realtime/use-workspace-changes.ts:47`
- Modify: `src/features/tasks/task-workspace.tsx:100`
- Modify: `src/features/tasks/create-task-dialog.tsx:20`
- Modify: `src/features/tasks/task-drawer.tsx:40`
- Modify: `src/features/comments/comment-section.tsx`
- Modify: `src/features/storage/attachments/attachment-section.tsx`
- Modify: `src/app/app/page.tsx:11`
- Create: `tests/unit/workspace-access-guard.test.tsx`
- Modify: `tests/unit/use-workspace-changes.test.tsx`

**Interfaces:**
- Consumes: stable action error codes and workspace/private-channel failures.
- Produces: `useWorkspaceAccessGuard({ workspaceId, currentUserId }): (code?: string) => Promise<boolean>` and optional `onAuthorizationError` in `useWorkspaceChanges`.

- [ ] **Step 1: Write failing access-guard tests**

Create `tests/unit/workspace-access-guard.test.tsx` with mocked browser Supabase client and router. Cover:

```ts
import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { useWorkspaceAccessGuard } from "@/features/workspaces/use-workspace-access-guard";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  removeAllChannels: vi.fn().mockResolvedValue([]),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

const builder = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle };
mocks.select.mockReturnValue(builder);
mocks.eq.mockReturnValue(builder);

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn(() => builder),
    removeAllChannels: mocks.removeAllChannels,
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.select.mockReturnValue(builder);
  mocks.eq.mockReturnValue(builder);
});

it("keeps the current page when membership still exists", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: { user_id: userId }, error: null });
  const { result } = renderHook(() => useWorkspaceAccessGuard({ workspaceId, currentUserId: userId }));
  await expect(result.current("FORBIDDEN")).resolves.toBe(false);
  expect(mocks.removeAllChannels).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("clears Realtime and navigates when membership disappeared", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  const { result } = renderHook(() => useWorkspaceAccessGuard({ workspaceId, currentUserId: userId }));
  await expect(result.current("FORBIDDEN")).resolves.toBe(true);
  expect(mocks.removeAllChannels).toHaveBeenCalledOnce();
  expect(mocks.replace).toHaveBeenCalledWith("/app?notice=membership-removed");
  expect(mocks.refresh).toHaveBeenCalledOnce();
});

it("does not treat a network error as membership revocation", async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: { code: "NETWORK" } });
  const { result } = renderHook(() => useWorkspaceAccessGuard({ workspaceId, currentUserId: userId }));
  await expect(result.current()).resolves.toBe(false);
  expect(mocks.removeAllChannels).not.toHaveBeenCalled();
});
```

Extend `tests/unit/use-workspace-changes.test.tsx` with an `onAuthorizationError` mock and assert it is called for `workspace:${workspaceId}` `CHANNEL_ERROR`, but not for a Postgres channel error.

- [ ] **Step 2: Run guard tests and verify RED**

Run: `pnpm exec vitest run tests/unit/workspace-access-guard.test.tsx tests/unit/use-workspace-changes.test.tsx`

Expected: FAIL because the guard and callback do not exist.

- [ ] **Step 3: Implement the membership recheck guard**

Create `src/features/workspaces/use-workspace-access-guard.ts`:

```ts
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";

export type WorkspaceAccessLossHandler = (code?: string) => Promise<boolean>;

export function useWorkspaceAccessGuard({ workspaceId, currentUserId }: { workspaceId: string; currentUserId: string }): WorkspaceAccessLossHandler {
  const router = useRouter();
  const checking = useRef<Promise<boolean> | null>(null);

  return useCallback(async (code?: string) => {
    if (code && code !== "FORBIDDEN") return false;
    if (checking.current) return checking.current;
    const check = (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", currentUserId)
        .maybeSingle();
      if (error || data) return false;
      await supabase.removeAllChannels();
      toast.error("你的工作区访问权限已发生变化");
      router.replace("/app?notice=membership-removed");
      router.refresh();
      return true;
    })();
    checking.current = check;
    try { return await check; } finally { checking.current = null; }
  }, [currentUserId, router, workspaceId]);
}
```

- [ ] **Step 4: Surface private-channel authorization errors**

Add optional `onAuthorizationError?: () => void` to `useWorkspaceChanges`. Inside `handleChannelStatus`, when `kind === "workspace" && nextStatus === "CHANNEL_ERROR"`, call it after clearing Presence and typing. Add the callback to the effect dependency list. Do not call it for Postgres `CHANNEL_ERROR`, `CLOSED`, offline, or generic exceptions.

- [ ] **Step 5: Connect action failures to the guard**

Add `useCallback` to the React imports in `TaskWorkspace`, then create:

```ts
const handlePossibleAccessLoss = useWorkspaceAccessGuard({ workspaceId, currentUserId });
const handleRealtimeAuthorizationError = useCallback(() => {
  void handlePossibleAccessLoss();
}, [handlePossibleAccessLoss]);
```

Pass the stable `handleRealtimeAuthorizationError` callback to `useWorkspaceChanges` as `onAuthorizationError`. Add `onPossibleAccessLoss?: WorkspaceAccessLossHandler` props to `CreateTaskDialog`, `TaskDrawer`, `CommentSection`, and `AttachmentSection`, passing the same handler through `TaskWorkspace` and `TaskDrawer`.

For every failed task, comment, or attachment action, execute this before storing the local error:

```ts
if (await onPossibleAccessLoss?.(result.error.code)) return;
```

This preserves task-not-found errors when membership still exists and only redirects after the membership recheck returns no row.

- [ ] **Step 6: Render a deterministic overview notice**

Change `AppPage` to accept `searchParams: Promise<{ notice?: string | string[] }>` and render an `InlineAlert` above the workspace list when the first value equals `membership-removed`:

```tsx
<InlineAlert variant="error" title="工作区权限已更新">
  你已不再是该工作区成员，当前页面和实时连接已清理。
</InlineAlert>
```

- [ ] **Step 7: Run focused guard, Realtime, and workspace tests**

Run:

```bash
pnpm exec vitest run tests/unit/workspace-access-guard.test.tsx tests/unit/use-workspace-changes.test.tsx tests/unit/task-workspace.test.tsx
pnpm test
```

Expected: suspected authorization errors trigger exactly one membership recheck; only a missing membership clears all channels and redirects.

- [ ] **Step 8: Commit revoked-access handling**

```bash
git add src/features/workspaces src/features/realtime src/features/tasks src/features/comments src/features/storage/attachments src/app/app/page.tsx tests/unit/workspace-access-guard.test.tsx tests/unit/use-workspace-changes.test.tsx tests/unit/task-workspace.test.tsx
git commit -m "feat(workspaces): handle revoked access"
```

---

### Task 6: Database authorization, browser flow, documentation, and final verification

**Files:**
- Modify: `supabase/tests/database/members.test.sql:5`
- Modify: `tests/e2e/fixtures/auth.ts`
- Create: `tests/e2e/member-management.spec.ts`
- Modify: `README.md`
- Modify: `docs/TECH.md:140`
- Modify: `docs/DEVELOPMENT.md:976`

**Interfaces:**
- Consumes: all prior tasks and existing Alice/Bob/Charlie E2E fixture helpers.
- Produces: repeatable stage-14 pgTAP and Playwright acceptance coverage, documented local function command, and stage status.

- [ ] **Step 1: Extend pgTAP with removal and Realtime authorization assertions**

Change `select plan(9);` to `select plan(14);` in `supabase/tests/database/members.test.sql`, then append before `finish()`:

```sql
select tests.authenticate_as('bob');
set local role authenticated;

select lives_ok(
  $$delete from public.workspace_members
    where workspace_id = tests.workspace_id('alpha')
      and user_id = tests.user_id('alice')$$,
  'a normal member cannot delete the Owner row'
);

reset role;
select is(
  (
    select count(*)::integer
    from public.workspace_members
    where workspace_id = tests.workspace_id('alpha')
      and user_id = tests.user_id('alice')
      and role = 'owner'
  ),
  1,
  'the Owner row remains after a member delete attempt'
);

select tests.authenticate_as('alice');
set local role authenticated;
select lives_ok(
  $$delete from public.workspace_members
    where workspace_id = tests.workspace_id('alpha')
      and user_id = tests.user_id('bob')
      and role = 'member'$$,
  'the Owner can remove an ordinary member'
);

reset role;
select tests.authenticate_as('bob');
select is(
  (
    select count(*)::integer
    from public.workspace_members
    where workspace_id = tests.workspace_id('alpha')
  ),
  0,
  'the removed member can no longer read Alpha memberships'
);

select is(
  private.is_workspace_topic_member('workspace:' || tests.workspace_id('alpha')::text),
  false,
  'the removed member can no longer authorize the private workspace topic'
);
```

- [ ] **Step 2: Run pgTAP and verify the database contract**

Run:

```bash
HOME=/private/tmp/codex-supabase-home pnpm exec supabase db reset
HOME=/private/tmp/codex-supabase-home pnpm exec supabase test db --local
```

Expected: all pgTAP files pass. If this exact test is green, do not create a migration.

- [ ] **Step 3: Add a dedicated Owner-only workspace fixture**

Extend `tests/e2e/fixtures/auth.ts` with:

```ts
type MemberManagementWorkspace = { workspaceId: string; workspaceName: string };
```

Add `memberManagementWorkspace: MemberManagementWorkspace` to `Fixtures`, then add this fixture body to `base.extend`:

```ts
memberManagementWorkspace: async ({ actors }, fixtureUse) => {
  const workspaceName = `Members ${randomUUID().slice(0, 8)}`;
  const aliceClient = await createAuthenticatedClient(actors.alice);
  const { data: workspaceId, error } = await aliceClient.rpc("create_workspace", {
    name: workspaceName,
  });
  if (error || !workspaceId) {
    throw new Error(`无法创建成员管理测试工作区: ${error?.message ?? "未知错误"}`);
  }
  await fixtureUse({ workspaceId, workspaceName });
},
```

Do not insert Bob in this fixture. Existing actor cleanup already deletes Alice-owned workspaces, so no separate cleanup path is required.

- [ ] **Step 4: Write the browser acceptance test**

Create `tests/e2e/member-management.spec.ts` with one serial flow:

```ts
import { expect, test, createAuthenticatedClient } from "./fixtures/auth";

test("Owner 添加和移除成员后，被移除成员失去数据与 Realtime 权限", async ({
  page,
  browser,
  actors,
  loginAs,
  memberManagementWorkspace,
}) => {
  const { workspaceId, workspaceName } = memberManagementWorkspace;
  await loginAs(page, actors.alice);
  await page.goto(`/app/workspaces/${workspaceId}?tab=members`);
  await page.getByRole("button", { name: "添加成员" }).click();
  await page.getByLabel("邮箱").fill(actors.bob.email);
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await expect(page.getByText("成员已添加")).toBeVisible();
  await expect(page.getByText("Bob", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "添加成员" }).click();
  await page.getByLabel("邮箱").fill(actors.bob.email);
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await expect(page.getByText("该用户已经是工作区成员")).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  await page.getByRole("button", { name: "添加成员" }).click();
  await page.getByLabel("邮箱").fill(`missing-${actors.charlie.id}@example.com`);
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await expect(page.getByText("未找到该用户，请让对方先完成注册")).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();

  const bobClient = await createAuthenticatedClient(actors.bob);
  const { error: forbiddenError } = await bobClient.functions.invoke("add-member-by-email", {
    body: { workspaceId, email: actors.charlie.email },
  });
  expect(forbiddenError).not.toBeNull();
  expect((forbiddenError as { context?: Response }).context?.status).toBe(403);

  const bobContext = await browser.newContext({ baseURL: "http://localhost:3000" });
  try {
    const bobPage = await bobContext.newPage();
    await loginAs(bobPage, actors.bob);
    await bobPage.goto(`/app/workspaces/${workspaceId}`);
    await expect(bobPage.getByRole("heading", { name: workspaceName })).toBeVisible();
    await expect(bobPage.getByRole("button", { name: "添加成员" })).toHaveCount(0);

    await page.getByRole("button", { name: "移除 Bob" }).click();
    await page.getByRole("button", { name: "确认移除" }).click();
    await expect(page.getByText("成员已移除")).toBeVisible();

    await bobContext.setOffline(true);
    await bobContext.setOffline(false);
    await expect(bobPage).toHaveURL(/\/app\?notice=membership-removed$/);
    await expect(bobPage.getByText("你已不再是该工作区成员")).toBeVisible();
    await expect(bobPage.getByText(workspaceName)).toHaveCount(0);
  } finally {
    await bobContext.close();
  }
});
```

- [ ] **Step 5: Update README and technical docs**

Update `README.md` current progress to stage 14, replace the obsolete positional function command with:

```bash
APP_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 pnpm exec supabase functions serve
```

Use this exact README progress summary:

```markdown
> 当前进度：已完成阶段 14——Edge Function 与成员管理。Owner 可以按已注册邮箱添加成员并移除普通成员；函数先以用户 JWT 和 RLS 证明 Owner 权限，再惰性创建管理员客户端查询 Auth 用户并写入成员关系。被移除成员的后续请求和 Realtime 重连会失去权限。
```

Add this runtime note beside the function command:

```markdown
`APP_ORIGINS` 是 Edge Function 的显式浏览器来源白名单；托管环境通过 Function secrets/environment 配置正式域名。Secret key 只由 Supabase Edge Runtime 提供，不得写入 Next.js 环境变量。
```

Append this paragraph to `docs/TECH.md` section 13.2.3:

```markdown
实施使用 `@supabase/server/core` 的低层原语：`verifyAuth` 验证用户 JWT，`createContextClient` 创建 RLS 用户客户端并确认 Owner 成员关系，只有检查通过后才调用 `createAdminClient`。`APP_ORIGINS` 控制精确 CORS 响应；无 Origin 的服务端调用仍必须通过 JWT 和 Owner 检查。
```

Append this paragraph to stage 14 in `docs/DEVELOPMENT.md`:

```markdown
> 实施状态（2026-07-11）：已完成。`add-member-by-email` 保持平台 JWT 校验，先以用户客户端和 RLS 证明 Owner 权限，再惰性创建管理员客户端，在最多 1000 个 Auth 用户内按标准化邮箱查找并写入普通成员；CORS 使用 `APP_ORIGINS` 精确白名单。成员页为 Owner 提供添加弹窗和移除确认框，普通成员仍只读取公开资料。pgTAP、Vitest 与 Playwright 覆盖未注册、重复、非 Owner、移除后数据拒绝及 Realtime 重连失败；邀请、角色变更和 Owner 转移仍不在本阶段范围。
```

- [ ] **Step 6: Run the complete stage verification set**

With `supabase functions serve` still running in its own terminal, run fresh commands:

```bash
git diff --check
HOME=/private/tmp/codex-supabase-home pnpm exec supabase db reset
HOME=/private/tmp/codex-supabase-home pnpm exec supabase test db --local
HOME=/private/tmp/codex-supabase-home pnpm exec supabase db advisors --local --type all --level warn --fail-on error
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm exec playwright test tests/e2e/member-management.spec.ts
pnpm test:e2e
```

Expected: every command exits 0; pgTAP reports no failures; Vitest reports all files green; ESLint and TypeScript emit no errors; Next.js production build succeeds; the stage-specific and full Chromium suites pass.

- [ ] **Step 7: Review secret exposure and final diff**

Run:

```bash
rg -n --hidden -g '!node_modules' -g '!.git' 'SUPABASE_(SECRET|SERVICE)|service_role|sb_secret_' src tests README.md docs supabase/functions
git status --short
git diff --stat
git diff -- README.md docs src supabase tests
```

Expected: matches are limited to explanatory documentation, test-only environment readers, and Edge runtime APIs; no literal secret value, Authorization header, apikey value, or real credential is present. The diff contains only stage-14 files and the approved design/plan artifacts.

- [ ] **Step 8: Commit tests and stage documentation**

```bash
git add README.md docs/TECH.md docs/DEVELOPMENT.md docs/superpowers/plans/2026-07-11-stage-14-edge-member-management.md supabase/tests/database/members.test.sql tests/e2e/fixtures/auth.ts tests/e2e/member-management.spec.ts
git commit -m "test(members): verify stage 14 flows"
```

After the commit, rerun `git status --short --branch` and `git show --check --oneline HEAD`; the worktree must be clean.
