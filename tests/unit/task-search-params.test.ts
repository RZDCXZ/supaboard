import { describe, expect, it } from "vitest";

import {
  clampTaskPageSize,
  parseTaskSearchParams,
} from "@/features/tasks/search-params";

const userId = "33333333-3333-4333-8333-333333333333";
const taskId = "22222222-2222-4222-8222-222222222222";

describe("task search params", () => {
  it("parses supported filters, page and selected task", () => {
    expect(
      parseTaskSearchParams({
        status: "in_progress",
        assignee: userId,
        page: "3",
        task: taskId,
      }),
    ).toEqual({
      status: "in_progress",
      assignee: userId,
      page: 3,
      taskId,
    });
  });

  it("supports the unassigned filter", () => {
    expect(parseTaskSearchParams({ assignee: "unassigned" }).assignee).toBe(
      "unassigned",
    );
  });

  it("falls back safely for invalid values", () => {
    expect(
      parseTaskSearchParams({
        status: "blocked",
        assignee: "someone",
        page: "-2",
        task: "bad",
      }),
    ).toEqual({
      status: "all",
      assignee: "all",
      page: 1,
      taskId: null,
    });
  });

  it("uses the first value for repeated parameters", () => {
    expect(
      parseTaskSearchParams({ status: ["done", "todo"], page: ["2", "4"] }),
    ).toMatchObject({ status: "done", page: 2 });
  });

  it("defaults to 20 items and caps callers at 100", () => {
    expect(clampTaskPageSize()).toBe(20);
    expect(clampTaskPageSize(0)).toBe(20);
    expect(clampTaskPageSize(40)).toBe(40);
    expect(clampTaskPageSize(500)).toBe(100);
  });
});
