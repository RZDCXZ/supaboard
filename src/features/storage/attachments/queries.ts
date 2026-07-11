import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAvatarPublicUrl } from "@/features/storage/avatar";
import type { WorkspaceRole } from "@/features/workspaces/types";
import type { Database } from "@/types/database";

import type { AttachmentItem } from "./types";

export const ATTACHMENT_SELECT =
  "id, task_id, workspace_id, uploader_id, file_name, content_type, size_bytes, created_at, uploader:profiles!attachments_uploader_id_fkey(id, display_name, avatar_path)" as const;

export type AttachmentRow = {
  id: string;
  task_id: string;
  workspace_id: string;
  uploader_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  uploader: {
    id: string;
    display_name: string;
    avatar_path: string | null;
  } | null;
};

export class AttachmentQueryError extends Error {
  constructor(message = "ATTACHMENT_QUERY_FAILED") {
    super(message);
    this.name = "AttachmentQueryError";
  }
}

export function mapAttachmentRow(
  row: AttachmentRow,
  supabase: SupabaseClient<Database>,
  currentUserId: string,
  workspaceRole: WorkspaceRole,
): AttachmentItem {
  if (!row.uploader) {
    throw new AttachmentQueryError("ATTACHMENT_UPLOADER_MISSING");
  }

  return {
    id: row.id,
    taskId: row.task_id,
    workspaceId: row.workspace_id,
    uploader: {
      id: row.uploader.id,
      displayName: row.uploader.display_name,
      avatarUrl: getAvatarPublicUrl(supabase, row.uploader.avatar_path),
    },
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at,
    canDelete: row.uploader_id === currentUserId || workspaceRole === "owner",
  };
}

export async function getTaskAttachments(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  taskId: string,
  currentUserId: string,
  workspaceRole: WorkspaceRole,
): Promise<AttachmentItem[]> {
  const { data, error } = await supabase
    .from("attachments")
    .select(ATTACHMENT_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new AttachmentQueryError();

  return ((data ?? []) as AttachmentRow[]).map((row) =>
    mapAttachmentRow(row, supabase, currentUserId, workspaceRole),
  );
}
