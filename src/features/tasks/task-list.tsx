"use client";

import { ChevronDownIcon, ClipboardListIcon, PlusIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import type { TaskItem, TaskStatus } from "./types";

const statusOrder: TaskStatus[] = ["todo", "in_progress", "done"];
const statusLabels: Record<TaskStatus, string> = {
  todo: "待办",
  in_progress: "进行中",
  done: "已完成",
};
const priorityLabels = { low: "低", medium: "中", high: "高" } as const;

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function TaskRow({ task, onOpen }: { task: TaskItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid min-h-18 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{task.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">优先级：{priorityLabels[task.priority]}</Badge>
          {task.assignee ? (
            <span className="inline-flex items-center gap-1.5">
              <Avatar size="sm">
                <AvatarFallback>{initials(task.assignee.displayName)}</AvatarFallback>
              </Avatar>
              {task.assignee.displayName}
            </span>
          ) : (
            <span>未分配</span>
          )}
        </span>
      </span>
      <time className="text-xs text-muted-foreground" dateTime={task.updatedAt}>
        {formatDate(task.updatedAt)}
      </time>
    </button>
  );
}

export function TaskList({
  tasks,
  statusFilter,
  hasFilters,
  onOpenTask,
  onClearFilters,
  onCreateTask,
}: {
  tasks: readonly TaskItem[];
  statusFilter: TaskStatus | "all";
  hasFilters: boolean;
  onOpenTask: (taskId: string) => void;
  onClearFilters: () => void;
  onCreateTask: () => void;
}) {
  if (tasks.length === 0) {
    return (
      <Empty className="min-h-64 border border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardListIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            {hasFilters ? "没有符合当前筛选条件的任务" : "当前工作区还没有任务"}
          </EmptyTitle>
          <EmptyDescription>
            {hasFilters ? "清除筛选后查看全部任务。" : "创建第一条任务开始协作。"}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" onClick={hasFilters ? onClearFilters : onCreateTask}>
            {hasFilters ? (
              "清除筛选"
            ) : (
              <>
                <PlusIcon data-icon="inline-start" />
                新建任务
              </>
            )}
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const visibleStatuses = statusFilter === "all" ? statusOrder : [statusFilter];

  return (
    <div className="flex flex-col gap-3">
      {visibleStatuses.map((status) => {
        const groupTasks = tasks.filter((task) => task.status === status);

        return (
          <Collapsible key={status} defaultOpen className="rounded-xl bg-card ring-1 ring-foreground/10">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="h-12 w-full justify-between rounded-b-none px-4">
                <span className="inline-flex items-center gap-2">
                  {statusLabels[status]}
                  <Badge variant="secondary">{groupTasks.length}</Badge>
                </span>
                <ChevronDownIcon aria-hidden="true" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {groupTasks.length > 0 ? (
                groupTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onOpen={() => onOpenTask(task.id)} />
                ))
              ) : (
                <p className="border-t border-border px-4 py-5 text-sm text-muted-foreground">
                  当前分组没有任务
                </p>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
