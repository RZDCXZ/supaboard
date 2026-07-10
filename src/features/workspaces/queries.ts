import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import type { WorkspaceDetail, WorkspaceListItem, WorkspaceRole } from "./types";

type WorkspaceMemberRow = {
  role: string;
  workspaces: {
    id: string;
    name: string;
    updated_at: string;
  } | null;
};

function toWorkspaceRole(role: string): WorkspaceRole {
  return role === "owner" ? "owner" : "member";
}

function byUpdatedAtDesc(a: WorkspaceListItem, b: WorkspaceListItem) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export class WorkspaceQueryError extends Error {
  constructor(message = "WORKSPACE_QUERY_FAILED") {
    super(message);
    this.name = "WorkspaceQueryError";
  }
}

export async function getCurrentUserWorkspaces(
  supabase: SupabaseClient<Database>,
): Promise<WorkspaceListItem[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name, updated_at)")
    .eq("user_id", user.id);

  if (error) {
    throw new WorkspaceQueryError();
  }

  return ((data ?? []) as WorkspaceMemberRow[])
    .flatMap((item) => {
      if (!item.workspaces) return [];

      return [
        {
          id: item.workspaces.id,
          name: item.workspaces.name,
          role: toWorkspaceRole(item.role),
          updatedAt: item.workspaces.updated_at,
          href: `/app/workspaces/${item.workspaces.id}`,
        },
      ];
    })
    .sort(byUpdatedAtDesc);
}

export async function getWorkspaceById(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
): Promise<WorkspaceDetail | null> {
  const [userResult, workspaceResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("workspaces")
      .select("id, name, owner_id, updated_at")
      .eq("id", workspaceId)
      .maybeSingle(),
  ]);
  const { data, error } = workspaceResult;

  if (error || userResult.error) {
    throw new WorkspaceQueryError();
  }

  if (!data || !userResult.data.user) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    currentUserId: userResult.data.user.id,
    role: data.owner_id === userResult.data.user.id ? "owner" : "member",
    updatedAt: data.updated_at,
  };
}
