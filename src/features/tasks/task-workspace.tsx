"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useReducer, useState, useTransition } from "react";

import { InlineAlert } from "@/components/feedback/inline-alert";
import { Button } from "@/components/ui/button";
import type { CommentItem } from "@/features/comments/types";
import type { AttachmentItem } from "@/features/storage/attachments/types";
import type { WorkspaceRole } from "@/features/workspaces/types";

import { CreateTaskDialog } from "./create-task-dialog";
import { taskReducer } from "./reducer";
import { TaskDrawer } from "./task-drawer";
import { TaskFiltersBar } from "./task-filters";
import { TaskList } from "./task-list";
import { TaskStats } from "./task-stats";
import type {
  TaskFilters,
  TaskItem,
  TaskMemberOption,
  TaskPage,
  TaskStatus,
  WorkspaceTaskStats,
} from "./types";

function matchesFilters(task: TaskItem, filters: TaskFilters) {
  if (filters.status !== "all" && task.status !== filters.status) return false;
  if (filters.assignee === "unassigned" && task.assignee) return false;
  if (
    filters.assignee !== "all" &&
    filters.assignee !== "unassigned" &&
    task.assignee?.id !== filters.assignee
  ) {
    return false;
  }

  return true;
}

function adjustStats(
  stats: WorkspaceTaskStats | null,
  status: TaskStatus,
  amount: 1 | -1,
) {
  if (!stats) return null;

  return {
    ...stats,
    total: Math.max(0, stats.total + amount),
    todo: Math.max(0, stats.todo + (status === "todo" ? amount : 0)),
    inProgress: Math.max(
      0,
      stats.inProgress + (status === "in_progress" ? amount : 0),
    ),
    done: Math.max(0, stats.done + (status === "done" ? amount : 0)),
  };
}

export function TaskWorkspace({
  workspaceId,
  filters,
  taskPage,
  members,
  comments,
  attachments,
  commentsError = false,
  currentUserId,
  workspaceRole,
  membersError = false,
  stats,
  statsError,
  selectedTask,
}: {
  workspaceId: string;
  filters: TaskFilters;
  taskPage: TaskPage;
  members: readonly TaskMemberOption[];
  comments: readonly CommentItem[];
  attachments: readonly AttachmentItem[];
  commentsError?: boolean;
  currentUserId: string;
  workspaceRole: WorkspaceRole;
  membersError?: boolean;
  stats: WorkspaceTaskStats | null;
  statsError: boolean;
  selectedTask: TaskItem | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tasks, dispatch] = useReducer(taskReducer, taskPage.tasks);
  const [drawerTask, setDrawerTask] = useState(selectedTask);
  const [currentStats, setCurrentStats] = useState(stats);
  const [createOpen, setCreateOpen] = useState(false);
  const [isNavigating, startTransition] = useTransition();
  const hasFilters = filters.status !== "all" || filters.assignee !== "all";

  function href(params: URLSearchParams) {
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function replaceParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    startTransition(() => router.replace(href(params), { scroll: false }));
  }

  function changeStatus(status: TaskStatus | "all") {
    replaceParams((params) => {
      if (status === "all") params.delete("status");
      else params.set("status", status);
      params.delete("page");
      params.delete("task");
    });
  }

  function changeAssignee(assignee: string) {
    replaceParams((params) => {
      if (assignee === "all") params.delete("assignee");
      else params.set("assignee", assignee);
      params.delete("page");
      params.delete("task");
    });
  }

  function clearFilters() {
    replaceParams((params) => {
      params.delete("status");
      params.delete("assignee");
      params.delete("page");
      params.delete("task");
    });
  }

  function openTask(taskId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("task", taskId);
    startTransition(() => router.push(href(params), { scroll: false }));
  }

  function closeTask() {
    setDrawerTask(null);
    replaceParams((params) => params.delete("task"));
  }

  function changePage(page: number) {
    replaceParams((params) => {
      params.set("page", String(page));
      params.delete("task");
    });
  }

  function refresh() {
    startTransition(() => router.refresh());
  }

  const rangeStart = taskPage.total === 0 ? 0 : (taskPage.page - 1) * taskPage.pageSize + 1;
  const rangeEnd = Math.min(taskPage.page * taskPage.pageSize, taskPage.total);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <TaskStats stats={currentStats} error={statsError} />

      <section className="flex flex-col gap-4" aria-label="任务列表">
        {membersError ? (
          <InlineAlert variant="error" title="负责人选项暂不可用">
            仍可查看任务，但新建和编辑时暂时只能选择“未分配”。
          </InlineAlert>
        ) : null}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <TaskFiltersBar
            status={filters.status}
            assignee={filters.assignee}
            members={members}
            onStatusChange={changeStatus}
            onAssigneeChange={changeAssignee}
            onClear={clearFilters}
          />
          <CreateTaskDialog
            workspaceId={workspaceId}
            members={members}
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={(task) => {
              setCurrentStats((current) => adjustStats(current, task.status, 1));
              if (filters.page === 1 && matchesFilters(task, filters)) {
                dispatch({ type: "upsert", task });
              }
              refresh();
            }}
          />
        </div>

        <TaskList
          tasks={tasks}
          statusFilter={filters.status}
          hasFilters={hasFilters}
          onOpenTask={openTask}
          onClearFilters={clearFilters}
          onCreateTask={() => setCreateOpen(true)}
        />

        {taskPage.total > 0 ? (
          <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="任务分页">
            <p className="text-sm text-muted-foreground">
              {rangeStart}–{rangeEnd} / 共 {taskPage.total} 条
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isNavigating || taskPage.page <= 1}
                onClick={() => changePage(taskPage.page - 1)}
              >
                上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isNavigating || taskPage.page >= taskPage.totalPages}
                onClick={() => changePage(taskPage.page + 1)}
              >
                下一页
              </Button>
            </div>
          </nav>
        ) : null}
      </section>

      {drawerTask ? (
        <TaskDrawer
          key={`${drawerTask.id}:${drawerTask.updatedAt}`}
          open
          workspaceId={workspaceId}
          task={drawerTask}
          members={members}
          comments={comments}
          attachments={attachments}
          commentsError={commentsError}
          currentUserId={currentUserId}
          workspaceRole={workspaceRole}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) closeTask();
          }}
          onUpdated={(task) => {
            const previous = drawerTask;
            setDrawerTask(task);
            if (previous && previous.status !== task.status) {
              setCurrentStats((current) =>
                adjustStats(
                  adjustStats(current, previous.status, -1),
                  task.status,
                  1,
                ),
              );
            }
            if (tasks.some(({ id }) => id === task.id)) {
              dispatch(
                matchesFilters(task, filters)
                  ? { type: "upsert", task }
                  : { type: "remove", taskId: task.id },
              );
            }
            refresh();
          }}
          onDeleted={(taskId) => {
            if (drawerTask) {
              setCurrentStats((current) =>
                adjustStats(current, drawerTask.status, -1),
              );
            }
            dispatch({ type: "remove", taskId });
            closeTask();
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}
