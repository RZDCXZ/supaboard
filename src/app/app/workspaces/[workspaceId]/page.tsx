import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getWorkspaceTask,
  getWorkspaceTaskMembers,
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

  const [taskPageResult, membersResult, statsResult, selectedTaskResult] =
    await Promise.allSettled([
      getWorkspaceTaskPage(supabase, workspaceId, filters),
      getWorkspaceTaskMembers(supabase, workspaceId),
      getWorkspaceTaskStats(supabase, workspaceId),
      filters.taskId
        ? getWorkspaceTask(supabase, workspaceId, filters.taskId)
        : Promise.resolve(null),
    ]);

  const header = (
    <PageHeader
      title={workspace.name}
      description="创建、筛选和维护工作区任务"
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/app">返回总览</Link>
          </Button>
          <Badge variant={workspace.role === "owner" ? "default" : "secondary"}>
            {workspace.role === "owner" ? "Owner" : "成员"}
          </Badge>
        </div>
      }
    />
  );

  if (taskPageResult.status === "rejected") {
    return (
      <main>
        {header}
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
      <TaskWorkspace
        key={workspaceKey}
        workspaceId={workspaceId}
        filters={filters}
        taskPage={taskPage}
        members={membersResult.status === "fulfilled" ? membersResult.value : []}
        membersError={membersResult.status === "rejected"}
        stats={statsResult.status === "fulfilled" ? statsResult.value : null}
        statsError={statsResult.status === "rejected"}
        selectedTask={selectedTask}
      />
    </main>
  );
}
