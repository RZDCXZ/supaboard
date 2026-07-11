import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTask,
  deleteTask,
  updateTask,
} from "@/features/tasks/actions";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: taskId,
    workspace_id: workspaceId,
    title: "Task",
    description: null,
    status: "todo",
    priority: "medium",
    assignee_id: null,
    created_by: userId,
    created_at: "2026-07-10T00:00:00Z",
    updated_at: "2026-07-10T00:00:00Z",
    assignee: null,
    ...overrides,
  };
}

function clientWithBuilder(builder: Record<string, unknown>, authenticated = true) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? { id: userId } : null },
        error: null,
      }),
    },
    from: vi.fn(() => builder),
  };
}

describe("task actions", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("returns field errors before opening a Supabase client", async () => {
    const result = await createTask({ workspaceId, title: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", fields: { title: "请输入任务标题" } },
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires authentication inside every task action", async () => {
    mocks.createClient.mockResolvedValue(
      clientWithBuilder({}, false),
    );

    await expect(
      createTask({ workspaceId, title: "Task" }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_AUTHENTICATED" },
    });
  });

  it("creates a task with the authenticated user as creator", async () => {
    const builder = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    builder.insert.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: row(), error: null });
    const client = clientWithBuilder(builder);
    mocks.createClient.mockResolvedValue(client);

    const result = await createTask({ workspaceId, title: "  Task  " });

    expect(builder.insert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      title: "Task",
      description: null,
      status: "todo",
      priority: "medium",
      assignee_id: null,
      created_by: userId,
    });
    expect(result).toMatchObject({ ok: true, data: { id: taskId, title: "Task" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/app/workspaces/${workspaceId}`,
    );
  });

  it("maps a discriminated assignee patch to the database column", async () => {
    const builder = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({ data: row(), error: null });
    mocks.createClient.mockResolvedValue(clientWithBuilder(builder));

    const result = await updateTask({
      workspaceId,
      taskId,
      patch: { field: "assigneeId", value: null },
    });

    expect(builder.update).toHaveBeenCalledWith({ assignee_id: null });
    expect(builder.eq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(builder.eq).toHaveBeenNthCalledWith(2, "id", taskId);
    expect(result.ok).toBe(true);
  });

  it("maps permission errors to a stable response", async () => {
    const builder = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({ data: null, error: { code: "42501" } });
    mocks.createClient.mockResolvedValue(clientWithBuilder(builder));

    await expect(
      updateTask({
        workspaceId,
        taskId,
        patch: { field: "status", value: "done" },
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "你没有权限修改该任务" },
    });
  });

  it("does not claim a hidden task was deleted", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({
            error: {
              code: "FORBIDDEN",
              message: "任务不存在或你没有权限删除",
              requestId: "request-123",
            },
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      },
    });
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId } },
          error: null,
        }),
      },
      functions: { invoke },
    });

    await expect(deleteTask({ workspaceId, taskId })).resolves.toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "任务不存在或你没有权限删除" },
    });
  });

  it("delegates complete task deletion to the authenticated Edge Function", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { taskId },
      error: null,
    });
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: userId } },
          error: null,
        }),
      },
      functions: { invoke },
    });

    await expect(deleteTask({ workspaceId, taskId })).resolves.toEqual({
      ok: true,
      data: taskId,
    });
    expect(invoke).toHaveBeenCalledWith("delete-task", {
      body: { workspaceId, taskId },
    });
  });
});
