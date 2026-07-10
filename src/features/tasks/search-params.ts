import { z } from "zod";

import type { TaskFilters, TaskStatus } from "./types";

export type TaskSearchParams = Record<
  string,
  string | string[] | undefined
>;

const uuidSchema = z.string().uuid();
const taskStatuses = new Set<TaskStatus>(["todo", "in_progress", "done"]);

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return 1;

  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function clampTaskPageSize(pageSize?: number) {
  if (!pageSize || !Number.isInteger(pageSize) || pageSize < 1) return 20;
  return Math.min(pageSize, 100);
}

export function parseTaskSearchParams(
  searchParams: TaskSearchParams,
): TaskFilters {
  const statusValue = first(searchParams.status);
  const assigneeValue = first(searchParams.assignee);
  const taskValue = first(searchParams.task);

  const status = taskStatuses.has(statusValue as TaskStatus)
    ? (statusValue as TaskStatus)
    : "all";
  const assignee =
    assigneeValue === "unassigned" || uuidSchema.safeParse(assigneeValue).success
      ? (assigneeValue ?? "all")
      : "all";

  return {
    status,
    assignee,
    page: parsePage(first(searchParams.page)),
    taskId: uuidSchema.safeParse(taskValue).success ? (taskValue ?? null) : null,
  };
}
