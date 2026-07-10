import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateTaskDialog } from "@/features/tasks/create-task-dialog";
import { TaskDrawer } from "@/features/tasks/task-drawer";
import { TaskFiltersBar } from "@/features/tasks/task-filters";
import { TaskList } from "@/features/tasks/task-list";
import { TaskStats } from "@/features/tasks/task-stats";
import type { TaskItem, TaskMemberOption } from "@/features/tasks/types";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const userId = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock("@/features/tasks/actions", () => ({
  createTask: mocks.createTask,
  updateTask: mocks.updateTask,
  deleteTask: mocks.deleteTask,
}));

const members: TaskMemberOption[] = [
  { id: userId, displayName: "Alice", avatarPath: null },
];

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    workspaceId,
    title: "Ship stage 7",
    description: "Complete the task slice",
    status: "todo",
    priority: "medium",
    assignee: members[0] ?? null,
    createdBy: userId,
    createdAt: "2026-07-10T00:00:00Z",
    updatedAt: "2026-07-10T01:00:00Z",
    ...overrides,
  };
}

describe("task components", () => {
  beforeEach(() => {
    mocks.createTask.mockReset();
    mocks.updateTask.mockReset();
    mocks.deleteTask.mockReset();
  });

  it("renders four read-only stats cards", () => {
    render(
      <TaskStats
        stats={{ total: 5, todo: 2, inProgress: 1, done: 2 }}
        error={false}
      />,
    );

    expect(screen.getByText("全部")).toBeVisible();
    expect(screen.getByText("待办")).toBeVisible();
    expect(screen.getByText("进行中")).toBeVisible();
    expect(screen.getByText("已完成")).toBeVisible();
    expect(screen.getAllByText("2")).toHaveLength(2);
  });

  it("isolates stats errors from the task list", () => {
    render(<TaskStats stats={null} error />);

    expect(screen.getByText("统计暂不可用")).toBeVisible();
  });

  it("shows active filters and a clear action", () => {
    const onClear = vi.fn();
    render(
      <TaskFiltersBar
        status="done"
        assignee="all"
        members={members}
        onStatusChange={vi.fn()}
        onAssigneeChange={vi.fn()}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("groups task buttons by status and opens a selected task", () => {
    const onOpenTask = vi.fn();
    render(
      <TaskList
        tasks={[
          task(),
          task({
            id: "44444444-4444-4444-8444-444444444444",
            title: "Done task",
            status: "done",
            assignee: null,
          }),
        ]}
        statusFilter="all"
        hasFilters={false}
        onOpenTask={onOpenTask}
        onClearFilters={vi.fn()}
        onCreateTask={vi.fn()}
      />,
    );

    expect(screen.getByText("待办")).toBeVisible();
    expect(screen.getByText("进行中")).toBeVisible();
    expect(screen.getByText("已完成")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Ship stage 7/ }));
    expect(onOpenTask).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(screen.getByText("未分配")).toBeVisible();
  });

  it("opens a create dialog with documented defaults", () => {
    render(
      <CreateTaskDialog
        workspaceId={workspaceId}
        members={members}
        onCreated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "新建任务" }));

    expect(screen.getByRole("dialog", { name: "新建任务" })).toBeVisible();
    expect(screen.getByLabelText("标题")).toBeRequired();
    expect(screen.getByRole("combobox", { name: "状态" })).toHaveTextContent(
      "待办",
    );
    expect(screen.getByRole("combobox", { name: "优先级" })).toHaveTextContent(
      "中",
    );
    expect(screen.getByRole("combobox", { name: "负责人" })).toHaveTextContent(
      "未分配",
    );
  });

  it("renders editable task fields and a protected delete entry", () => {
    render(
      <TaskDrawer
        open
        workspaceId={workspaceId}
        task={task()}
        members={members}
        comments={[]}
        currentUserId={userId}
        workspaceRole="owner"
        onOpenChange={vi.fn()}
        onUpdated={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Ship stage 7" })).toBeVisible();
    expect(screen.getByLabelText("标题")).toHaveValue("Ship stage 7");
    expect(screen.getByLabelText("描述")).toHaveValue("Complete the task slice");
    expect(screen.getByRole("button", { name: "更多操作" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "评论" })).toBeVisible();
  });
});
