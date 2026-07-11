"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  ATTACHMENT_SELECT,
  mapAttachmentRow,
  type AttachmentRow,
} from "./queries";
import type { AttachmentActionResult, AttachmentItem } from "./types";
import {
  ATTACHMENT_BUCKET,
  attachmentActionInputSchema,
  buildAttachmentObjectPath,
  createAttachmentMetadataInputSchema,
  getAttachmentFieldErrors,
} from "./validation";

type AttachmentOperation = "create" | "download" | "delete";

function validationError(
  error: Parameters<typeof getAttachmentFieldErrors>[0],
): AttachmentActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR" as const,
      message: "请检查附件信息后重试",
      fields: getAttachmentFieldErrors(error),
    },
  };
}

function operationError(
  operation: AttachmentOperation,
  error: unknown,
): AttachmentActionResult<never> {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : undefined;

  if (code === "42501" || code === "23503") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "附件不存在或你没有权限执行此操作",
      },
    };
  }

  if (code === "23505") {
    return {
      ok: false,
      error: { code: "CONFLICT", message: "附件状态已变化，请刷新后重试" },
    };
  }

  console.error("Attachment action failed", { operation, code });
  const messages = {
    create: "暂时无法保存附件信息，请稍后重试",
    download: "暂时无法下载附件，请稍后重试",
    delete: "暂时无法删除附件，请稍后重试",
  } as const;

  return {
    ok: false,
    error: { code: "INTERNAL_ERROR", message: messages[operation] },
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

export async function createAttachmentMetadata(
  input: unknown,
): Promise<AttachmentActionResult<AttachmentItem>> {
  const parsed = createAttachmentMetadataInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const authenticated = await authenticatedClient();
  if (!authenticated) {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再上传附件" },
    };
  }

  const objectPath = buildAttachmentObjectPath(parsed.data);
  const { data, error } = await authenticated.supabase
    .from("attachments")
    .insert({
      workspace_id: parsed.data.workspaceId,
      task_id: parsed.data.taskId,
      uploader_id: authenticated.user.id,
      bucket_id: ATTACHMENT_BUCKET,
      object_path: objectPath,
      file_name: parsed.data.fileName,
      content_type: parsed.data.contentType,
      size_bytes: parsed.data.sizeBytes,
    })
    .select(ATTACHMENT_SELECT)
    .single();

  if (error || !data) return operationError("create", error);

  revalidateWorkspace(parsed.data.workspaceId);
  return {
    ok: true,
    data: mapAttachmentRow(
      data as AttachmentRow,
      authenticated.supabase,
      authenticated.user.id,
      "member",
    ),
  };
}

export async function getAttachmentDownload(
  input: unknown,
): Promise<AttachmentActionResult<{ url: string }>> {
  const parsed = attachmentActionInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const authenticated = await authenticatedClient();
  if (!authenticated) {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再下载附件" },
    };
  }

  const { data: attachment, error: lookupError } = await authenticated.supabase
    .from("attachments")
    .select("object_path, file_name")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("task_id", parsed.data.taskId)
    .eq("id", parsed.data.attachmentId)
    .maybeSingle();

  if (lookupError) return operationError("download", lookupError);
  if (!attachment) return operationError("download", { code: "42501" });

  const { data, error } = await authenticated.supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(attachment.object_path, 60, {
      download: attachment.file_name,
    });

  if (error || !data?.signedUrl) return operationError("download", error);
  return { ok: true, data: { url: data.signedUrl } };
}

export async function deleteAttachment(
  input: unknown,
): Promise<AttachmentActionResult<string>> {
  const parsed = attachmentActionInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const authenticated = await authenticatedClient();
  if (!authenticated) {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再删除附件" },
    };
  }

  const { data: attachment, error: lookupError } = await authenticated.supabase
    .from("attachments")
    .select("object_path")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("task_id", parsed.data.taskId)
    .eq("id", parsed.data.attachmentId)
    .maybeSingle();

  if (lookupError) return operationError("delete", lookupError);
  if (!attachment) return operationError("delete", { code: "42501" });

  const { error: storageError } = await authenticated.supabase.storage
    .from(ATTACHMENT_BUCKET)
    .remove([attachment.object_path]);

  if (storageError) return operationError("delete", storageError);

  const { data, error } = await authenticated.supabase
    .from("attachments")
    .delete()
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("task_id", parsed.data.taskId)
    .eq("id", parsed.data.attachmentId)
    .select("id")
    .maybeSingle();

  if (error) return operationError("delete", error);
  if (!data) return operationError("delete", { code: "42501" });

  revalidateWorkspace(parsed.data.workspaceId);
  return { ok: true, data: data.id };
}
