import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/features/activity/activity-timeline";
import { getWorkspaceActivityPage } from "@/features/activity/queries";
import { parseWorkspaceViewSearchParams } from "@/features/activity/search-params";
import { WorkspaceTabs } from "@/features/activity/workspace-tabs";
import { getTaskComments } from "@/features/comments/queries";
import { MemberList } from "@/features/members/member-list";
import { getWorkspaceMembers } from "@/features/members/queries";
import {
  getWorkspaceTask,
  getWorkspaceTaskPage,
  getWorkspaceTaskStats,
} from "@/features/tasks/queries";
import {
  parseTaskSearchParams,
  type TaskSearchParams,
} from "@/features/tasks/search-params";
import { TaskStats } from "@/features/tasks/task-stats";
import { TaskWorkspace } from "@/features/tasks/task-workspace";
import { getWorkspaceById, WorkspaceQueryError } from "@/features/workspaces/queries";
import { createClient } from "@/lib/supabase/server";

function toUrlSearchParams(searchParams: TaskSearchParams) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    const first = Array.isArray(value) ? value[0] : value;
    if (first) params.set(key, first);
  });

  return params;
}

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<TaskSearchParams>;
}) {
  const [{ workspaceId }, rawSearchParams] = await Promise.all([params, searchParams]);
  const filters = parseTaskSearchParams(rawSearchParams);
  const workspaceView = parseWorkspaceViewSearchParams(rawSearchParams);
  const supabase = await createClient();
  const workspace = await getWorkspaceById(supabase, workspaceId).catch((error) => {
    if (error instanceof WorkspaceQueryError) return null;
    throw error;
  });

  if (!workspace) {
    return (
      <main>
        <PageHeader title="工作区" description="无法访问请求的工作区" />
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-4 py-8 sm:px-6">
          <InlineAlert variant="error" title="工作区不存在或无权访问">
            该工作区不可用，请返回总览查看你已加入的工作区。
          </InlineAlert>
          <Button asChild variant="outline" className="w-fit">
            <Link href="/app">返回工作区总览</Link>
          </Button>
        </div>
      </main>
    );
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline">
        <Link href="/app">返回总览</Link>
      </Button>
      <Badge variant={workspace.role === "owner" ? "default" : "secondary"}>
        {workspace.role === "owner" ? "Owner" : "成员"}
      </Badge>
    </div>
  );
  const header = (
    <PageHeader
      title={workspace.name}
      description="创建、筛选和维护任务，查看自动活动记录"
      actions={headerActions}
    />
  );

  if (workspaceView.tab === "members") {
    const membersResult = await getWorkspaceMembers(supabase, workspaceId).then(
      (value) => ({ status: "fulfilled" as const, value }),
      () => ({ status: "rejected" as const }),
    );
    const members = membersResult.status === "fulfilled" ? membersResult.value : null;
    const retryHref = `/app/workspaces/${workspaceId}?tab=members`;

    return (
      <main>
        <PageHeader
          title={workspace.name}
          description={members ? `${members.length} 位成员` : "查看工作区成员"}
          actions={headerActions}
        />
        <WorkspaceTabs tab="members" />
        <MemberList
          members={members}
          error={membersResult.status === "rejected"}
          retryHref={retryHref}
        />
      </main>
    );
  }

  if (workspaceView.tab === "activity") {
    const activityResult = await getWorkspaceActivityPage(
      supabase,
      workspaceId,
      workspaceView.activityPage,
    ).then(
      (value) => ({ status: "fulfilled" as const, value }),
      () => ({ status: "rejected" as const }),
    );
    const currentParams = toUrlSearchParams(rawSearchParams);
    currentParams.set("tab", "activity");
    currentParams.delete("task");
    const retryQuery = currentParams.toString();
    const retryHref = `/app/workspaces/${workspaceId}${retryQuery ? `?${retryQuery}` : ""}`;

    if (activityResult.status === "rejected") {
      return (
        <main>
          {header}
          <WorkspaceTabs tab="activity" />
          <ActivityTimeline
            page={null}
            error
            loadMoreHref={null}
            retryHref={retryHref}
          />
        </main>
      );
    }

    const activityPage = activityResult.value;
    const totalBatches = Math.max(
      1,
      Math.ceil(activityPage.total / activityPage.pageSize),
    );
    if (workspaceView.activityPage > totalBatches) {
      if (totalBatches <= 1) currentParams.delete("activityPage");
      else currentParams.set("activityPage", String(totalBatches));
      const canonicalQuery = currentParams.toString();
      redirect(
        `/app/workspaces/${workspaceId}${canonicalQuery ? `?${canonicalQuery}` : ""}`,
      );
    }

    let loadMoreHref: string | null = null;
    if (activityPage.hasMore) {
      const loadMoreParams = new URLSearchParams(currentParams);
      loadMoreParams.set("activityPage", String(activityPage.batch + 1));
      loadMoreHref = `/app/workspaces/${workspaceId}?${loadMoreParams.toString()}`;
    }

    return (
      <main>
        {header}
        <WorkspaceTabs tab="activity" />
        <ActivityTimeline
          page={activityPage}
          loadMoreHref={loadMoreHref}
          retryHref={retryHref}
        />
      </main>
    );
  }

  const [taskPageResult, membersResult, statsResult, selectedTaskResult, commentsResult] =
    await Promise.allSettled([
      getWorkspaceTaskPage(supabase, workspaceId, filters),
      getWorkspaceMembers(supabase, workspaceId),
      getWorkspaceTaskStats(supabase, workspaceId),
      filters.taskId
        ? getWorkspaceTask(supabase, workspaceId, filters.taskId)
        : Promise.resolve(null),
      filters.taskId
        ? getTaskComments(supabase, workspaceId, filters.taskId)
        : Promise.resolve([]),
    ]);

  if (taskPageResult.status === "rejected") {
    return (
      <main>
        {header}
        <WorkspaceTabs tab="tasks" />
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <TaskStats
            stats={statsResult.status === "fulfilled" ? statsResult.value : null}
            error={statsResult.status === "rejected"}
          />
          <InlineAlert variant="error" title="任务列表加载失败">
            暂时无法读取任务，请稍后重试。
          </InlineAlert>
          <Button asChild variant="outline" className="w-fit">
            <Link href={`/app/workspaces/${workspaceId}`}>重试</Link>
          </Button>
        </div>
      </main>
    );
  }

  const taskPage = taskPageResult.value;
  if (filters.page > taskPage.totalPages) {
    const canonical = toUrlSearchParams(rawSearchParams);
    if (taskPage.totalPages <= 1) canonical.delete("page");
    else canonical.set("page", String(taskPage.totalPages));
    canonical.delete("task");
    const query = canonical.toString();
    redirect(`/app/workspaces/${workspaceId}${query ? `?${query}` : ""}`);
  }

  const selectedTask =
    selectedTaskResult.status === "fulfilled" ? selectedTaskResult.value : null;
  const workspaceKey = [
    workspaceId,
    filters.status,
    filters.assignee,
    filters.page,
    selectedTask?.id ?? "closed",
  ].join(":");

  return (
    <main>
      {header}
      <WorkspaceTabs tab="tasks" />
      <TaskWorkspace
        key={workspaceKey}
        workspaceId={workspaceId}
        filters={filters}
        taskPage={taskPage}
        members={membersResult.status === "fulfilled" ? membersResult.value : []}
        comments={commentsResult.status === "fulfilled" ? commentsResult.value : []}
        commentsError={Boolean(filters.taskId) && commentsResult.status === "rejected"}
        currentUserId={workspace.currentUserId}
        workspaceRole={workspace.role}
        membersError={membersResult.status === "rejected"}
        stats={statsResult.status === "fulfilled" ? statsResult.value : null}
        statsError={statsResult.status === "rejected"}
        selectedTask={selectedTask}
      />
    </main>
  );
}
