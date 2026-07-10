import { describe, expect, it, vi } from "vitest";

import {
  getWorkspaceActivityPage,
  mapActivityRow,
} from "@/features/activity/queries";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";

function activityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    workspace_id: workspaceId,
    actor_id: actorId,
    action: "task.status_changed",
    entity_type: "task",
    entity_id: taskId,
    metadata: {
      title: "Ship stage 8",
      from_status: "todo",
      to_status: "done",
    },
    created_at: "2026-07-10T02:00:00Z",
    actor: {
      id: actorId,
      display_name: "Alice",
      avatar_path: null,
    },
    ...overrides,
  };
}

describe("activity queries", () => {
  it("loads cumulative batches with stable descending order", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.range.mockResolvedValue({
      data: [activityRow()],
      error: null,
      count: 45,
    });
    const supabase = { from: vi.fn(() => builder) };

    const result = await getWorkspaceActivityPage(
      supabase as never,
      workspaceId,
      2,
    );

    expect(builder.select).toHaveBeenCalledWith(expect.any(String), {
      count: "exact",
    });
    expect(builder.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(builder.order).toHaveBeenNthCalledWith(1, "created_at", {
      ascending: false,
    });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", {
      ascending: false,
    });
    expect(builder.range).toHaveBeenCalledWith(0, 39);
    expect(result).toMatchObject({
      batch: 2,
      pageSize: 20,
      total: 45,
      hasMore: true,
    });
    expect(result.activities[0]).toMatchObject({
      action: "task.status_changed",
      title: "Ship stage 8",
      fromStatus: "todo",
      toStatus: "done",
      actor: { displayName: "Alice" },
    });
  });

  it("maps missing actors and malformed metadata to safe fallbacks", () => {
    expect(
      mapActivityRow(
        activityRow({ actor_id: null, actor: null, metadata: ["bad"] }),
      ),
    ).toMatchObject({
      actor: null,
      title: null,
      fromStatus: null,
      toStatus: null,
      status: null,
    });
  });
});
