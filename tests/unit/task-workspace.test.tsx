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
  realtime: {
    current: {
      status: "connected" as const,
      latestChange: null as null | {
        table: "tasks" | "comments";
        eventType: "INSERT" | "UPDATE" | "DELETE";
        id: string;
        commitTimestamp: string | null;
      },
      resyncVersion: 0,
    },
  },
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

vi.mock("@/features/comments/actions", () => ({
  createComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("@/features/realtime/use-workspace-changes", () => ({
  useWorkspaceChanges: () => mocks.realtime.current,
}));

function task(title = "Done task"): TaskItem {
  return {
    id: taskId,
    workspaceId,
    title,
    description: null,
    status: "done",
    priority: "medium",
    assignee: null,
    createdBy: "33333333-3333-4333-8333-333333333333",
    createdAt: "2026-07-10T00:00:00Z",
    updatedAt: "2026-07-10T01:00:00Z",
    attachmentCount: 0,
  };
}

beforeEach(() => {
  mocks.push.mockReset();
  mocks.refresh.mockReset();
  mocks.replace.mockReset();
  mocks.realtime.current = {
    status: "connected",
    latestChange: null,
    resyncVersion: 0,
  };
});

test("TaskWorkspace keeps filters, paging and task selection in the URL", () => {
  render(
    <TaskWorkspace
      workspaceId={workspaceId}
      filters={{ status: "done", assignee: "all", page: 1, taskId: null }}
      taskPage={{ tasks: [task()], page: 1, pageSize: 20, total: 21, totalPages: 2 }}
      members={[]}
      comments={[]}
      attachments={[]}
      currentUserId="33333333-3333-4333-8333-333333333333"
      workspaceRole="owner"
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

test("TaskWorkspace passes selected task comments and permissions into the drawer", () => {
  render(
    <TaskWorkspace
      workspaceId={workspaceId}
      filters={{ status: "done", assignee: "all", page: 1, taskId }}
      taskPage={{ tasks: [task()], page: 1, pageSize: 20, total: 1, totalPages: 1 }}
      members={[]}
      comments={[
        {
          id: "55555555-5555-4555-8555-555555555555",
          taskId,
          workspaceId,
          author: {
            id: "33333333-3333-4333-8333-333333333333",
            displayName: "Alice",
            avatarUrl: null,
          },
          body: "Stage 8 comment",
          createdAt: "2026-07-10T00:00:00Z",
          updatedAt: "2026-07-10T00:00:00Z",
        },
      ]}
      attachments={[
        {
          id: "66666666-6666-4666-8666-666666666666",
          taskId,
          workspaceId,
          uploader: {
            id: "33333333-3333-4333-8333-333333333333",
            displayName: "Alice",
            avatarUrl: null,
          },
          fileName: "stage-11.txt",
          contentType: "text/plain",
          sizeBytes: 12,
          createdAt: "2026-07-11T00:00:00Z",
          canDelete: true,
        },
      ]}
      currentUserId="33333333-3333-4333-8333-333333333333"
      workspaceRole="owner"
      stats={{ total: 1, todo: 0, inProgress: 0, done: 1 }}
      statsError={false}
      selectedTask={task()}
    />,
  );

  expect(screen.getByText("Stage 8 comment")).toBeVisible();
  expect(screen.getByText("stage-11.txt")).toBeVisible();
  expect(screen.getByRole("button", { name: "删除 Alice 的评论" })).toBeVisible();
});

test("TaskWorkspace reconciles local state when server data changes", () => {
  const props = {
    workspaceId,
    filters: { status: "done" as const, assignee: "all" as const, page: 1, taskId: null },
    members: [],
    comments: [],
    attachments: [],
    currentUserId: "33333333-3333-4333-8333-333333333333",
    workspaceRole: "owner" as const,
    stats: { total: 1, todo: 0, inProgress: 0, done: 1 },
    statsError: false,
    selectedTask: null,
  };
  const { rerender } = render(
    <TaskWorkspace
      {...props}
      taskPage={{ tasks: [task("Before realtime")], page: 1, pageSize: 20, total: 1, totalPages: 1 }}
    />,
  );

  expect(screen.getByRole("status", { name: "实时同步状态" })).toHaveTextContent(
    "已连接",
  );
  rerender(
    <TaskWorkspace
      {...props}
      taskPage={{ tasks: [task("After realtime")], page: 1, pageSize: 20, total: 1, totalPages: 1 }}
    />,
  );

  expect(screen.getByRole("button", { name: /After realtime/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Before realtime/ })).not.toBeInTheDocument();
});

test("TaskWorkspace removes a remotely deleted task before refetching", () => {
  const props = {
    workspaceId,
    filters: { status: "done" as const, assignee: "all" as const, page: 1, taskId: null },
    taskPage: { tasks: [task("Remote delete")], page: 1, pageSize: 20, total: 1, totalPages: 1 },
    members: [],
    comments: [],
    attachments: [],
    currentUserId: "33333333-3333-4333-8333-333333333333",
    workspaceRole: "owner" as const,
    stats: { total: 1, todo: 0, inProgress: 0, done: 1 },
    statsError: false,
    selectedTask: null,
  };
  const { rerender } = render(<TaskWorkspace {...props} />);

  mocks.realtime.current = {
    status: "connected",
    latestChange: {
      table: "tasks",
      eventType: "DELETE",
      id: taskId,
      commitTimestamp: null,
    },
    resyncVersion: 1,
  };
  rerender(<TaskWorkspace {...props} />);

  expect(screen.queryByRole("button", { name: /Remote delete/ })).not.toBeInTheDocument();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});
