import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { TaskWorkspace } from "@/features/tasks/task-workspace";
import type { TaskItem } from "@/features/tasks/types";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => `/app/workspaces/${workspaceId}`,
  useRouter: () => mocks,
  useSearchParams: () => new URLSearchParams("status=done&page=1"),
}));

vi.mock("@/features/tasks/actions", () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

function task(): TaskItem {
  return {
    id: taskId,
    workspaceId,
    title: "Done task",
    description: null,
    status: "done",
    priority: "medium",
    assignee: null,
    createdBy: "33333333-3333-4333-8333-333333333333",
    createdAt: "2026-07-10T00:00:00Z",
    updatedAt: "2026-07-10T01:00:00Z",
  };
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  mocks.replace.mockReset();
});

test("TaskWorkspace keeps filters, paging and task selection in the URL", () => {
  render(
    <TaskWorkspace
      workspaceId={workspaceId}
      filters={{ status: "done", assignee: "all", page: 1, taskId: null }}
      taskPage={{ tasks: [task()], page: 1, pageSize: 20, total: 21, totalPages: 2 }}
      members={[]}
      stats={{ total: 21, todo: 0, inProgress: 0, done: 21 }}
      statsError={false}
      selectedTask={null}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
  expect(mocks.replace).toHaveBeenCalledWith(`/app/workspaces/${workspaceId}`, {
    scroll: false,
  });

  fireEvent.click(screen.getByRole("button", { name: /Done task/ }));
  expect(mocks.push).toHaveBeenCalledWith(
    `/app/workspaces/${workspaceId}?status=done&page=1&task=${taskId}`,
    { scroll: false },
  );

  expect(screen.getByText("1–20 / 共 21 条")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "下一页" }));
  expect(mocks.replace).toHaveBeenCalledWith(
    `/app/workspaces/${workspaceId}?status=done&page=2`,
    { scroll: false },
  );
});
