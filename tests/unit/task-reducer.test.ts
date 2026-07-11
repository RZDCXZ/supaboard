import { describe, expect, it } from "vitest";

import { taskReducer } from "@/features/tasks/reducer";
import type { TaskItem } from "@/features/tasks/types";

function task(id: string, updatedAt: string, title = id): TaskItem {
  return {
    id,
    workspaceId: "11111111-1111-4111-8111-111111111111",
    title,
    description: null,
    status: "todo",
    priority: "medium",
    assignee: null,
    createdBy: "33333333-3333-4333-8333-333333333333",
    createdAt: updatedAt,
    updatedAt,
    attachmentCount: 0,
  };
}

describe("taskReducer", () => {
  it("replaces the current server-confirmed page", () => {
    const next = taskReducer([task("old", "2026-07-10T00:00:00Z")], {
      type: "replace",
      tasks: [task("new", "2026-07-10T01:00:00Z")],
    });

    expect(next.map(({ id }) => id)).toEqual(["new"]);
  });

  it("upserts without duplicates and keeps newest tasks first", () => {
    const next = taskReducer(
      [
        task("a", "2026-07-10T01:00:00Z"),
        task("b", "2026-07-10T02:00:00Z"),
      ],
      {
        type: "upsert",
        task: task("a", "2026-07-10T03:00:00Z", "Updated"),
      },
    );

    expect(next.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(next[0]?.title).toBe("Updated");
  });

  it("uses id as a deterministic tie breaker", () => {
    const timestamp = "2026-07-10T01:00:00Z";
    const next = taskReducer([], {
      type: "replace",
      tasks: [task("a", timestamp), task("b", timestamp)],
    });

    expect(next.map(({ id }) => id)).toEqual(["b", "a"]);
  });

  it("removes a confirmed deleted task", () => {
    const next = taskReducer(
      [task("a", "2026-07-10T01:00:00Z"), task("b", "2026-07-10T02:00:00Z")],
      { type: "remove", taskId: "b" },
    );

    expect(next.map(({ id }) => id)).toEqual(["a"]);
  });
});
