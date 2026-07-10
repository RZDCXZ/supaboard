import { ActivityIcon } from "lucide-react";
import Link from "next/link";

import { InlineAlert } from "@/components/feedback/inline-alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatFullDateTime, formatRelativeDateTime } from "@/lib/date-time";

import type { ActivityItem, ActivityPage } from "./types";

const statusLabels = {
  todo: "待办",
  in_progress: "进行中",
  done: "已完成",
} as const;

function taskLabel(activity: ActivityItem) {
  return activity.title ?? activity.entityId.slice(0, 8);
}

function activityText(activity: ActivityItem) {
  const actor = activity.actor?.displayName ?? "系统";
  const task = taskLabel(activity);

  if (activity.action === "task.created") {
    return `${actor} 创建了任务“${task}”`;
  }

  if (activity.action === "task.deleted") {
    return `${actor} 删除了任务“${task}”`;
  }

  if (activity.fromStatus && activity.toStatus) {
    return `${actor} 将任务“${task}”从“${statusLabels[activity.fromStatus]}”改为“${statusLabels[activity.toStatus]}”`;
  }

  return `${actor} 更新了任务“${task}”的状态`;
}

function avatarFallback(activity: ActivityItem) {
  return activity.actor?.displayName.trim().slice(0, 1).toUpperCase() || "系";
}

export function ActivityTimeline({
  page,
  error = false,
  loadMoreHref,
  retryHref,
}: {
  page: ActivityPage | null;
  error?: boolean;
  loadMoreHref: string | null;
  retryHref: string;
}) {
  if (error || !page) {
    return (
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <InlineAlert variant="error" title="活动记录加载失败">
          暂时无法读取活动记录，请稍后重试。
        </InlineAlert>
        <Button asChild variant="outline" className="w-fit">
          <Link href={retryHref}>重试</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>任务活动</CardTitle>
          <CardDescription>由数据库自动记录，成员只能查看。</CardDescription>
        </CardHeader>
        <CardContent>
          {page.activities.length === 0 ? (
            <Empty className="min-h-64 border border-border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ActivityIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>还没有任务活动</EmptyTitle>
                <EmptyDescription>
                  创建任务或修改任务状态后会自动记录。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-5">
              <ol className="flex flex-col gap-5" aria-label="任务活动时间线">
                {page.activities.map((activity) => (
                  <li key={activity.id} className="flex gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{avatarFallback(activity)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{activityText(activity)}</p>
                      <time
                        className="mt-1 block text-xs text-muted-foreground"
                        dateTime={activity.createdAt}
                        title={formatFullDateTime(activity.createdAt)}
                      >
                        {formatRelativeDateTime(activity.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
              {page.hasMore && loadMoreHref ? (
                <Button asChild variant="outline" className="w-fit self-center">
                  <Link href={loadMoreHref} scroll={false}>
                    加载更多
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
