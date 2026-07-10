import { describe, expect, it } from "vitest";

import {
  createTaskInputSchema,
  deleteTaskInputSchema,
  updateTaskInputSchema,
} from "@/features/tasks/validation";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const assigneeId = "33333333-3333-4333-8333-333333333333";

describe("task validation", () => {
  it("trims task text and applies create defaults", () => {
    const result = createTaskInputSchema.parse({
      workspaceId,
      title: "  Ship stage 7  ",
      description: "   ",
      assigneeId: "",
    });

    expect(result).toEqual({
      workspaceId,
      title: "Ship stage 7",
      description: null,
      status: "todo",
      priority: "medium",
      assigneeId: null,
    });
  });

  it("rejects blank and overlong task content", () => {
    expect(
      createTaskInputSchema.safeParse({ workspaceId, title: "   " }).success,
    ).toBe(false);
    expect(
      createTaskInputSchema.safeParse({
        workspaceId,
        title: "Valid",
        description: "x".repeat(5001),
      }).success,
    ).toBe(false);
  });

  it("rejects invalid enums and identifiers", () => {
    expect(
      createTaskInputSchema.safeParse({
        workspaceId: "not-a-uuid",
        title: "Valid",
        status: "blocked",
        priority: "urgent",
        assigneeId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("accepts one allowlisted update field", () => {
    expect(
      updateTaskInputSchema.parse({
        workspaceId,
        taskId,
        patch: { field: "assigneeId", value: assigneeId },
      }),
    ).toEqual({
      workspaceId,
      taskId,
      patch: { field: "assigneeId", value: assigneeId },
    });

    expect(
      updateTaskInputSchema.safeParse({
        workspaceId,
        taskId,
        patch: { field: "createdBy", value: assigneeId },
      }).success,
    ).toBe(false);
  });

  it("validates delete identifiers", () => {
    expect(deleteTaskInputSchema.parse({ workspaceId, taskId })).toEqual({
      workspaceId,
      taskId,
    });
    expect(
      deleteTaskInputSchema.safeParse({ workspaceId, taskId: "bad" }).success,
    ).toBe(false);
  });
});
