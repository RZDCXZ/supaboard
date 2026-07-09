import { PlusIcon } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { CreateWorkspaceDialog } from "@/features/workspaces/create-workspace-dialog";
import {
  getCurrentUserWorkspaces,
  WorkspaceQueryError,
} from "@/features/workspaces/queries";
import type { WorkspaceListItem } from "@/features/workspaces/types";
import { WorkspaceList, WorkspaceLoadError } from "@/features/workspaces/workspace-list";
import { createClient } from "@/lib/supabase/server";

export default async function AppPage() {
  const supabase = await createClient();
  let workspaces: WorkspaceListItem[] = [];
  let hasLoadError = false;

  try {
    workspaces = await getCurrentUserWorkspaces(supabase);
  } catch (error) {
    if (error instanceof WorkspaceQueryError) {
      hasLoadError = true;
    } else {
      throw error;
    }
  }

  return (
    <main>
      <PageHeader
        title="工作区"
        description="查看你已加入的工作区"
        actions={
          <CreateWorkspaceDialog
            trigger={
              <Button>
                <PlusIcon data-icon="inline-start" />
                创建工作区
              </Button>
            }
          />
        }
      />
      {hasLoadError ? <WorkspaceLoadError /> : <WorkspaceList workspaces={workspaces} />}
    </main>
  );
}
