"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { COMMENT_SELECT, mapCommentRow, type CommentRow } from "./queries";
import type { CommentActionResult, CommentItem } from "./types";
import {
  createCommentInputSchema,
  deleteCommentInputSchema,
  getCommentFieldErrors,
} from "./validation";

type CommentOperation = "create" | "delete";
type DatabaseError = { code?: string; message?: string } | null;

function validationError(
  error: Parameters<typeof getCommentFieldErrors>[0],
): CommentActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "请检查评论内容后重试",
      fields: getCommentFieldErrors(error),
    },
  };
}

function databaseError(
  operation: CommentOperation,
  error: DatabaseError,
): CommentActionResult<never> {
  if (error?.code === "42501" || error?.code === "23503") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message:
          operation === "create"
            ? "任务不存在或你没有权限发表评论"
            : "评论不存在或你没有权限删除",
      },
    };
  }

  if (error?.code === "23514") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "请检查评论内容后重试",
        fields: { body: "评论内容不符合要求" },
      },
    };
  }

  if (error?.code === "23505" || error?.code === "P0001") {
    return {
      ok: false,
      error: { code: "CONFLICT", message: "评论状态已变化，请刷新后重试" },
    };
  }

  console.error("Comment action failed", {
    operation,
    code: error?.code,
  });

  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message:
        operation === "create"
          ? "暂时无法发表评论，请稍后重试"
          : "暂时无法删除评论，请稍后重试",
    },
  };
}

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return error || !user ? null : { supabase, user };
}

function revalidateWorkspace(workspaceId: string) {
  revalidatePath(`/app/workspaces/${workspaceId}`);
}

export async function createComment(
  input: unknown,
): Promise<CommentActionResult<CommentItem>> {
  const parsed = createCommentInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const authenticated = await authenticatedClient();
  if (!authenticated) {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再发表评论" },
    };
  }

  const { data, error } = await authenticated.supabase
    .from("comments")
    .insert({
      workspace_id: parsed.data.workspaceId,
      task_id: parsed.data.taskId,
      author_id: authenticated.user.id,
      body: parsed.data.body,
    })
    .select(COMMENT_SELECT)
    .single();

  if (error || !data) return databaseError("create", error);

  revalidateWorkspace(parsed.data.workspaceId);
  return {
    ok: true,
    data: mapCommentRow(data as CommentRow, authenticated.supabase),
  };
}

export async function deleteComment(
  input: unknown,
): Promise<CommentActionResult<string>> {
  const parsed = deleteCommentInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const authenticated = await authenticatedClient();
  if (!authenticated) {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再删除评论" },
    };
  }

  const { data, error } = await authenticated.supabase
    .from("comments")
    .delete()
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("task_id", parsed.data.taskId)
    .eq("id", parsed.data.commentId)
    .select("id")
    .maybeSingle();

  if (error) return databaseError("delete", error);
  if (!data) return databaseError("delete", { code: "42501" });

  revalidateWorkspace(parsed.data.workspaceId);
  return { ok: true, data: data.id };
}
