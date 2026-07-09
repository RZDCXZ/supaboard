import { FolderKanbanIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/app-shell/page-header";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getWorkspaceById, WorkspaceQueryError } from "@/features/workspaces/queries";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const workspace = await getWorkspaceById(supabase, workspaceId).catch((error) => {
    if (error instanceof WorkspaceQueryError) {
      return null;
    }

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

  return (
    <main>
      <PageHeader title={workspace.name} description="工作区任务将在下一阶段接入" />
      <div className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-6 lg:px-8">
        <Empty className="min-h-64 border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanbanIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>当前工作区还没有任务</EmptyTitle>
            <EmptyDescription>任务列表和维护流程将在阶段 7 接入。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </main>
  );
}
