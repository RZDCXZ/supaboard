import type { TaskItem } from "./types";

export type TaskReducerAction =
  | { type: "replace"; tasks: TaskItem[] }
  | { type: "upsert"; task: TaskItem }
  | { type: "remove"; taskId: string };

function byUpdatedAtDesc(a: TaskItem, b: TaskItem) {
  const byDate = b.updatedAt.localeCompare(a.updatedAt);
  return byDate === 0 ? b.id.localeCompare(a.id) : byDate;
}

export function taskReducer(
  state: readonly TaskItem[],
  action: TaskReducerAction,
): TaskItem[] {
  if (action.type === "replace") {
    return action.tasks.toSorted(byUpdatedAtDesc);
  }

  if (action.type === "remove") {
    return state.filter(({ id }) => id !== action.taskId);
  }

  const next = state.filter(({ id }) => id !== action.task.id);
  next.push(action.task);
  return next.toSorted(byUpdatedAtDesc);
}
