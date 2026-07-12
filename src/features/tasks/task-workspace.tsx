"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useOptimistic,
  useState,
  useTransition,
} from "react";

import { InlineAlert } from "@/components/feedback/inline-alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { CommentItem } from "@/features/comments/types";
import type { AttachmentItem } from "@/features/storage/attachments/types";
import { useWorkspaceChanges } from "@/features/realtime/use-workspace-changes";
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

function avatarFallback(displayName: string) {
  return displayName.trim().slice(0, 1).toUpperCase() || "用";
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

type StatsOptimisticAction =
  | { type: "add"; status: TaskStatus }
  | { type: "remove"; status: TaskStatus }
  | { type: "move"; from: TaskStatus; to: TaskStatus };

function optimisticStatsReducer(
  stats: WorkspaceTaskStats | null,
  action: StatsOptimisticAction,
) {
  if (action.type === "add") return adjustStats(stats, action.status, 1);
  if (action.type === "remove") return adjustStats(stats, action.status, -1);

  return adjustStats(
    adjustStats(stats, action.from, -1),
    action.to,
    1,
  );
}

function replaceDrawerTask(
  _current: TaskItem | null,
  next: TaskItem | null,
) {
  return next;
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
  const [tasks, dispatchTasks] = useOptimistic(taskPage.tasks, taskReducer);
  const [drawerTask, setDrawerTask] = useOptimistic(
    selectedTask,
    replaceDrawerTask,
  );
  const [currentStats, dispatchStats] = useOptimistic(
    stats,
    optimisticStatsReducer,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [isNavigating, startTransition] = useTransition();
  const [locallyDeletingTaskId, setLocallyDeletingTaskId] = useState<
    string | null
  >(null);
  const currentUserDisplayName =
    members.find(({ id }) => id === currentUserId)?.displayName ?? "当前用户";
  const {
    status,
    latestChange,
    resyncVersion,
    onlineMembers,
    typingUserIds,
    notifyTyping,
    accessRevoked,
  } = useWorkspaceChanges({
    workspaceId,
    currentUserId,
    currentUserDisplayName,
    activeTaskId: drawerTask?.id ?? null,
  });
  const searchParamsString = searchParams.toString();
  const hasFilters = filters.status !== "all" || filters.assignee !== "all";
  const membersById = new Map(members.map((member) => [member.id, member]));
  const visibleOnlineMembers = onlineMembers.map((presence) => {
    const member = membersById.get(presence.userId);
    return {
      id: presence.userId,
      displayName: member?.displayName ?? presence.displayName,
      avatarUrl: member?.avatarUrl ?? null,
    };
  });
  const displayedOnlineMembers = visibleOnlineMembers.slice(0, 5);
  const hiddenOnlineMemberCount = Math.max(0, visibleOnlineMembers.length - 5);
  const typingMembers = typingUserIds.map((userId) => {
    const member = membersById.get(userId);
    return {
      id: userId,
      displayName:
        member?.displayName ??
        onlineMembers.find((presence) => presence.userId === userId)?.displayName ??
        "成员",
      avatarUrl: member?.avatarUrl ?? null,
    };
  });

  const realtimeStatusLabels = {
    connecting: "连接中",
    connected: "已连接",
    reconnecting: "正在重连",
    disconnected: "已断开",
  } as const;

  const isLocalDeleteEcho =
    latestChange?.table === "tasks" &&
    latestChange.eventType === "DELETE" &&
    locallyDeletingTaskId === latestChange.id;
  const remotelyDeletedTaskId =
    latestChange?.table === "tasks" && latestChange.eventType === "DELETE"
      && !isLocalDeleteEcho
      ? latestChange.id
      : null;
  const visibleDrawerTask =
    drawerTask?.id === remotelyDeletedTaskId ? null : drawerTask;
  const visibleTasks = remotelyDeletedTaskId
    ? tasks.filter(({ id }) => id !== remotelyDeletedTaskId)
    : tasks;

  useEffect(() => {
    if (!accessRevoked) return;

    startTransition(() => {
      router.replace("/app");
      router.refresh();
    });
  }, [accessRevoked, router]);

  useEffect(() => {
    if (resyncVersion === 0) return;
    if (isLocalDeleteEcho) return;

    startTransition(() => {
      if (
        latestChange?.table === "tasks" &&
        latestChange.eventType === "DELETE" &&
        drawerTask?.id === latestChange.id
      ) {
        const params = new URLSearchParams(searchParamsString);
        params.delete("task");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      }

      router.refresh();
    });
  }, [
    drawerTask?.id,
    isLocalDeleteEcho,
    latestChange,
    pathname,
    resyncVersion,
    router,
    searchParamsString,
  ]);

  function href(params: URLSearchParams) {
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function replaceParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParamsString);
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
    const params = new URLSearchParams(searchParamsString);
    params.set("task", taskId);
    startTransition(() => router.push(href(params), { scroll: false }));
  }

  function closeTask() {
    const params = new URLSearchParams(searchParamsString);
    params.delete("task");
    startTransition(() => {
      setDrawerTask(null);
      router.replace(href(params), { scroll: false });
    });
  }

  function changePage(page: number) {
    replaceParams((params) => {
      params.set("page", String(page));
      params.delete("task");
    });
  }

  const rangeStart = taskPage.total === 0 ? 0 : (taskPage.page - 1) * taskPage.pageSize + 1;
  const rangeEnd = Math.min(taskPage.page * taskPage.pageSize, taskPage.total);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <p
          role="status"
          aria-label="实时同步状态"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${
              status === "connected" ? "bg-emerald-500" : "bg-muted-foreground/50"
            }`}
          />
          实时同步：{realtimeStatusLabels[status]}
        </p>
        <div
          aria-label="在线成员"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <span>在线 {visibleOnlineMembers.length}</span>
          {visibleOnlineMembers.length > 0 ? (
            <div className="flex -space-x-2" aria-hidden="true">
              {displayedOnlineMembers.map((member) => (
                <Avatar
                  key={member.id}
                  size="sm"
                  title={`${member.displayName} 在线`}
                  className="ring-2 ring-background"
                >
                  {member.avatarUrl ? (
                    <AvatarImage src={member.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback>{avatarFallback(member.displayName)}</AvatarFallback>
                </Avatar>
              ))}
              {hiddenOnlineMemberCount > 0 ? (
                <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background">
                  +{hiddenOnlineMemberCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
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
              startTransition(() => {
                dispatchStats({ type: "add", status: task.status });
                if (filters.page === 1 && matchesFilters(task, filters)) {
                  dispatchTasks({ type: "upsert", task });
                }
                router.refresh();
              });
            }}
          />
        </div>

        <TaskList
          tasks={visibleTasks}
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

      {visibleDrawerTask ? (
        <TaskDrawer
          key={`${visibleDrawerTask.id}:${visibleDrawerTask.updatedAt}`}
          open
          workspaceId={workspaceId}
          task={visibleDrawerTask}
          members={members}
          comments={comments}
          realtimeChange={latestChange}
          attachments={attachments}
          commentsError={commentsError}
          currentUserId={currentUserId}
          workspaceRole={workspaceRole}
          typingMembers={typingMembers}
          onTypingChange={notifyTyping}
          onDeletePendingChange={(taskId, pending) => {
            setLocallyDeletingTaskId(pending ? taskId : null);
          }}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) closeTask();
          }}
          onUpdated={(task) => {
            const previous = drawerTask;
            startTransition(() => {
              setDrawerTask(task);
              if (previous && previous.status !== task.status) {
                dispatchStats({
                  type: "move",
                  from: previous.status,
                  to: task.status,
                });
              }
              if (tasks.some(({ id }) => id === task.id)) {
                dispatchTasks(
                  matchesFilters(task, filters)
                    ? { type: "upsert", task }
                    : { type: "remove", taskId: task.id },
                );
              }
              router.refresh();
            });
          }}
          onDeleted={(taskId) => {
            const params = new URLSearchParams(searchParamsString);
            params.delete("task");
            startTransition(() => {
              if (drawerTask) {
                dispatchStats({ type: "remove", status: drawerTask.status });
              }
              dispatchTasks({ type: "remove", taskId });
              router.replace(href(params), { scroll: false });
            });
          }}
        />
      ) : null}
    </div>
  );
}
