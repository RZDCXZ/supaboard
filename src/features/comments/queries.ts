import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import type { CommentItem } from "./types";

export const COMMENT_SELECT =
  "id, task_id, workspace_id, author_id, body, created_at, updated_at, author:profiles!comments_author_id_fkey(id, display_name, avatar_path)" as const;

export type CommentRow = {
  id: string;
  task_id: string;
  workspace_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    display_name: string;
    avatar_path: string | null;
  } | null;
};

export class CommentQueryError extends Error {
  constructor(message = "COMMENT_QUERY_FAILED") {
    super(message);
    this.name = "CommentQueryError";
  }
}

export function mapCommentRow(row: CommentRow): CommentItem {
  if (!row.author) {
    throw new CommentQueryError("COMMENT_AUTHOR_MISSING");
  }

  return {
    id: row.id,
    taskId: row.task_id,
    workspaceId: row.workspace_id,
    author: {
      id: row.author.id,
      displayName: row.author.display_name,
      avatarPath: row.author.avatar_path,
    },
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTaskComments(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  taskId: string,
): Promise<CommentItem[]> {
  const { data, error } = await supabase
    .from("comments")
    .select(COMMENT_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new CommentQueryError();
  }

  return ((data ?? []) as CommentRow[]).map(mapCommentRow);
}
