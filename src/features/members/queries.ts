import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import type { WorkspaceMember, WorkspaceMemberRole } from "./types";

type WorkspaceMemberRow = {
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    id: string;
    display_name: string;
    avatar_path: string | null;
  } | null;
};

export class MemberQueryError extends Error {
  constructor(message = "MEMBER_QUERY_FAILED") {
    super(message);
    this.name = "MemberQueryError";
  }
}

function toWorkspaceMemberRole(role: string): WorkspaceMemberRole {
  if (role === "owner" || role === "member") return role;
  throw new MemberQueryError("INVALID_MEMBER_ROLE");
}

export async function getWorkspaceMembers(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      "user_id, role, joined_at, profiles!workspace_members_user_id_fkey(id, display_name, avatar_path)",
    )
    .eq("workspace_id", workspaceId)
    .order("role", { ascending: false })
    .order("joined_at", { ascending: true })
    .order("user_id", { ascending: true });

  if (error) {
    throw new MemberQueryError();
  }

  return ((data ?? []) as WorkspaceMemberRow[]).flatMap((row) =>
    row.profiles
      ? [
          {
            id: row.profiles.id,
            displayName: row.profiles.display_name,
            avatarPath: row.profiles.avatar_path,
            role: toWorkspaceMemberRole(row.role),
            joinedAt: row.joined_at,
          },
        ]
      : [],
  );
}
