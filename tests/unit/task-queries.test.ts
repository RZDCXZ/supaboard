import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getWorkspaceTaskMembers,
  getWorkspaceTaskPage,
  getWorkspaceTaskStats,
} from "@/features/tasks/queries";
import type { TaskFilters } from "@/features/tasks/types";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "33333333-3333-4333-8333-333333333333";

function filters(overrides: Partial<TaskFilters> = {}): TaskFilters {
  return {
    status: "all",
    assignee: "all",
    page: 1,
    taskId: null,
    ...overrides,
  };
}

function taskRow() {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    workspace_id: workspaceId,
    title: "Task",
    description: null,
    status: "todo",
    priority: "medium",
    assignee_id: userId,
    created_by: userId,
    created_at: "2026-07-10T00:00:00Z",
    updated_at: "2026-07-10T01:00:00Z",
    assignee: {
      id: userId,
      display_name: "Alice",
      avatar_path: null,
    },
  };
}

describe("task queries", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("applies filters, stable ordering and inclusive pagination", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.range.mockResolvedValue({ data: [taskRow()], error: null, count: 45 });
    const supabase = { from: vi.fn(() => builder) };

    const result = await getWorkspaceTaskPage(
      supabase as never,
      workspaceId,
      filters({ status: "todo", assignee: "unassigned", page: 2 }),
      500,
    );

    expect(builder.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(builder.eq).toHaveBeenCalledWith("status", "todo");
    expect(builder.is).toHaveBeenCalledWith("assignee_id", null);
    expect(builder.order).toHaveBeenNthCalledWith(1, "updated_at", {
      ascending: false,
    });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
    expect(builder.range).toHaveBeenCalledWith(100, 199);
    expect(result).toMatchObject({ page: 2, pageSize: 100, total: 45, totalPages: 1 });
    expect(result.tasks[0]?.assignee?.displayName).toBe("Alice");
  });

  it("filters by a concrete assignee", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.range.mockResolvedValue({ data: [], error: null, count: 0 });
    const supabase = { from: vi.fn(() => builder) };

    await getWorkspaceTaskPage(
      supabase as never,
      workspaceId,
      filters({ assignee: userId }),
    );

    expect(builder.eq).toHaveBeenCalledWith("assignee_id", userId);
  });

  it("maps workspace members to assignment options", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [
        {
          user_id: userId,
          profiles: { id: userId, display_name: "Alice", avatar_path: null },
        },
      ],
      error: null,
    });
    const supabase = { from: vi.fn(() => builder) };

    await expect(
      getWorkspaceTaskMembers(supabase as never, workspaceId),
    ).resolves.toEqual([{ id: userId, displayName: "Alice", avatarPath: null }]);
  });

  it("maps the workspace stats RPC result", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ total: 4, todo: 1, in_progress: 2, done: 1 }],
        error: null,
      }),
    };

    await expect(
      getWorkspaceTaskStats(supabase as never, workspaceId),
    ).resolves.toEqual({ total: 4, todo: 1, inProgress: 2, done: 1 });
    expect(supabase.rpc).toHaveBeenCalledWith("get_workspace_stats", {
      target_workspace_id: workspaceId,
    });
  });
});
