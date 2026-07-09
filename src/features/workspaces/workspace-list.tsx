import { FolderKanbanIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { InlineAlert } from "@/components/feedback/inline-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import type { WorkspaceListItem, WorkspaceRole } from "./types";

function formatRole(role: WorkspaceRole) {
  return role === "owner" ? "Owner" : "成员";
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRelativeDate(value: string) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 30) return `${diffDays} 天前`;

  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

export function WorkspaceLoadError() {
  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
      <InlineAlert variant="error" title="工作区加载失败">
        暂时无法读取工作区，请稍后重试。
      </InlineAlert>
      <Button asChild variant="outline" className="w-fit">
        <Link href="/app">重试</Link>
      </Button>
    </div>
  );
}

export function WorkspaceList({
  workspaces,
}: {
  workspaces: readonly WorkspaceListItem[];
}) {
  if (workspaces.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-6 lg:px-8">
        <Empty className="min-h-64 border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanbanIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>还没有工作区</EmptyTitle>
            <EmptyDescription>创建后可以添加任务和成员。</EmptyDescription>
            <CreateWorkspaceDialog
              trigger={
                <Button className="mt-2">
                  <PlusIcon data-icon="inline-start" />
                  创建工作区
                </Button>
              }
            />
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3">
        {workspaces.map((workspace) => (
          <Link
            key={workspace.id}
            href={workspace.href}
            className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{workspace.name}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                最近更新{" "}
                <time dateTime={workspace.updatedAt} title={formatFullDate(workspace.updatedAt)}>
                  {formatRelativeDate(workspace.updatedAt)}
                </time>
              </span>
            </span>
            <Badge variant={workspace.role === "owner" ? "default" : "secondary"}>
              {formatRole(workspace.role)}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
