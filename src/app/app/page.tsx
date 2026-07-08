import { FolderKanbanIcon } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function AppPage() {
  return (
    <main>
      <PageHeader
        title="工作区"
        description="查看你已加入的工作区"
      />
      <div className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-6 lg:px-8">
        <Empty className="min-h-64 border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanbanIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>还没有工作区</EmptyTitle>
            <EmptyDescription>
              加入工作区后，你可以在这里查看任务和成员。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </main>
  );
}
