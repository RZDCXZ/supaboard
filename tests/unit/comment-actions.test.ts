import { beforeEach, describe, expect, it, vi } from "vitest";

import { createComment, deleteComment } from "@/features/comments/actions";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const commentId = "44444444-4444-4444-8444-444444444444";

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

function row() {
  return {
    id: commentId,
    task_id: taskId,
    workspace_id: workspaceId,
    author_id: userId,
    body: "Hello",
    created_at: "2026-07-10T01:00:00Z",
    updated_at: "2026-07-10T01:00:00Z",
    author: {
      id: userId,
      display_name: "Alice",
      avatar_path: null,
    },
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

describe("comment actions", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("returns body validation before opening a Supabase client", async () => {
    await expect(
      createComment({ workspaceId, taskId, body: "   " }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", fields: { body: "请输入评论内容" } },
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires authentication inside comment actions", async () => {
    mocks.createClient.mockResolvedValue(clientWithBuilder({}, false));

    await expect(
      createComment({ workspaceId, taskId, body: "Hello" }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "NOT_AUTHENTICATED" },
    });
  });

  it("creates a trimmed comment for the authenticated author", async () => {
    const builder = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    builder.insert.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: row(), error: null });
    mocks.createClient.mockResolvedValue(clientWithBuilder(builder));

    const result = await createComment({
      workspaceId,
      taskId,
      body: "  Hello  ",
    });

    expect(builder.insert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      task_id: taskId,
      author_id: userId,
      body: "Hello",
    });
    expect(result).toMatchObject({ ok: true, data: { id: commentId } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/app/workspaces/${workspaceId}`,
    );
  });

  it("does not claim a hidden comment was deleted", async () => {
    const builder = {
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    builder.delete.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.createClient.mockResolvedValue(clientWithBuilder(builder));

    await expect(
      deleteComment({ workspaceId, taskId, commentId }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "评论不存在或你没有权限删除" },
    });
  });
});
