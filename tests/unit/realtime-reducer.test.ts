import { describe, expect, it } from "vitest";

import {
  initialWorkspaceChangeState,
  workspaceChangeReducer,
} from "@/features/realtime/reducer";

describe("workspaceChangeReducer", () => {
  it("accepts the first valid insert and ignores an exact duplicate", () => {
    const event = {
      table: "tasks",
      eventType: "INSERT",
      id: "11111111-1111-4111-8111-111111111111",
      commitTimestamp: "2026-07-11T01:00:00Z",
    } as const;

    const inserted = workspaceChangeReducer(initialWorkspaceChangeState, event);
    const duplicate = workspaceChangeReducer(inserted, event);

    expect(inserted.revision).toBe(1);
    expect(inserted.latestChange).toEqual(event);
    expect(duplicate).toBe(inserted);
  });

  it("ignores updates older than the newest event for an entity", () => {
    const inserted = workspaceChangeReducer(initialWorkspaceChangeState, {
      table: "tasks",
      eventType: "INSERT",
      id: "11111111-1111-4111-8111-111111111111",
      commitTimestamp: "2026-07-11T01:00:00Z",
    });
    const updated = workspaceChangeReducer(inserted, {
      table: "tasks",
      eventType: "UPDATE",
      id: "11111111-1111-4111-8111-111111111111",
      commitTimestamp: "2026-07-11T01:02:00Z",
    });
    const stale = workspaceChangeReducer(updated, {
      table: "tasks",
      eventType: "UPDATE",
      id: "11111111-1111-4111-8111-111111111111",
      commitTimestamp: "2026-07-11T01:01:00Z",
    });

    expect(updated.revision).toBe(2);
    expect(stale).toBe(updated);
  });

  it("accepts an id-only delete and treats it as a permanent tombstone", () => {
    const deleted = workspaceChangeReducer(initialWorkspaceChangeState, {
      table: "comments",
      eventType: "DELETE",
      id: "22222222-2222-4222-8222-222222222222",
      commitTimestamp: null,
    });
    const lateUpdate = workspaceChangeReducer(deleted, {
      table: "comments",
      eventType: "UPDATE",
      id: "22222222-2222-4222-8222-222222222222",
      commitTimestamp: "2026-07-11T01:03:00Z",
    });
    const duplicateDelete = workspaceChangeReducer(deleted, {
      table: "comments",
      eventType: "DELETE",
      id: "22222222-2222-4222-8222-222222222222",
      commitTimestamp: null,
    });

    expect(deleted.revision).toBe(1);
    expect(deleted.latestChange?.id).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(lateUpdate).toBe(deleted);
    expect(duplicateDelete).toBe(deleted);
  });

  it("ignores unknown tables, events and incomplete rows", () => {
    expect(
      workspaceChangeReducer(initialWorkspaceChangeState, {
        table: "activity_logs",
        eventType: "INSERT",
        id: "33333333-3333-4333-8333-333333333333",
        commitTimestamp: "2026-07-11T01:00:00Z",
      }),
    ).toBe(initialWorkspaceChangeState);
    expect(
      workspaceChangeReducer(initialWorkspaceChangeState, {
        table: "tasks",
        eventType: "TRUNCATE",
        id: "33333333-3333-4333-8333-333333333333",
        commitTimestamp: "2026-07-11T01:00:00Z",
      }),
    ).toBe(initialWorkspaceChangeState);
    expect(
      workspaceChangeReducer(initialWorkspaceChangeState, {
        table: "tasks",
        eventType: "UPDATE",
        id: "",
        commitTimestamp: "2026-07-11T01:00:00Z",
      }),
    ).toBe(initialWorkspaceChangeState);
  });
});
