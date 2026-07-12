"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

import { mapTaskRow, TASK_SELECT, type TaskRow } from "./queries";
import type {
  ActionResult,
  TaskItem,
  TaskPatch,
} from "./types";
import {
  createTaskInputSchema,
  deleteTaskInputSchema,
  getTaskFieldErrors,
  updateTaskInputSchema,
} from "./validation";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
type DatabaseError = { code?: string; message?: string } | null;
type TaskOperation = "create" | "update" | "delete";

function validationError(
  error: Parameters<typeof getTaskFieldErrors>[0],
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR" as const,
      message: "请检查任务信息后重试",
      fields: getTaskFieldErrors(error),
    },
  };
}

function operationMessage(operation: TaskOperation) {
  if (operation === "create") return "暂时无法创建任务，请稍后重试";
  if (operation === "update") return "暂时无法保存任务，请稍后重试";
  return "暂时无法删除任务，请稍后重试";
}

function forbiddenMessage(operation: TaskOperation) {
  if (operation === "create") return "你没有权限在该工作区创建任务";
  if (operation === "update") return "你没有权限修改该任务";
  return "任务不存在或你没有权限删除";
}

function databaseError(
  operation: TaskOperation,
  error: DatabaseError,
): ActionResult<never> {
  if (error?.code === "42501") {
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: forbiddenMessage(operation) },
    };
  }

  if (error?.code === "23514") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "负责人必须属于当前工作区",
        fields: { assigneeId: "请选择当前工作区成员" },
      },
    };
  }

  if (
    error?.code === "23503" ||
    error?.code === "23505" ||
    error?.code === "P0001"
  ) {
    return {
      ok: false,
      error: { code: "CONFLICT", message: "任务状态已变化，请刷新后重试" },
    };
  }

  console.error("Task action failed", {
    operation,
    code: error?.code,
  });

  return {
    ok: false,
    error: { code: "INTERNAL_ERROR", message: operationMessage(operation) },
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

function patchToDatabase(patch: TaskPatch): TaskUpdate {
  if (patch.field === "assigneeId") {
    return { assignee_id: patch.value };
  }

  return { [patch.field]: patch.value };
}

function revalidateWorkspace(workspaceId: string) {
  revalidatePath(`/app/workspaces/${workspaceId}`);
}

async function edgeDeleteError(error: unknown): Promise<ActionResult<never>> {
  let payload: {
    error?: { code?: string; message?: string; requestId?: string };
  } | null = null;
  const context =
    typeof error === "object" && error && "context" in error
      ? error.context
      : null;

  if (context instanceof Response) {
    try {
      payload = await context.json();
    } catch {
      payload = null;
    }
  }

  const code = payload?.error?.code;
  if (code === "FORBIDDEN") {
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "任务不存在或你没有权限删除" },
    };
  }

  if (code === "NOT_AUTHENTICATED") {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再删除任务" },
    };
  }

  console.error("delete-task Edge Function failed", {
    code,
    requestId: payload?.error?.requestId,
  });
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message:
        code === "ATTACHMENT_CLEANUP_FAILED"
          ? "附件清理失败，任务尚未删除，请稍后重试"
          : "暂时无法删除任务，请稍后重试",
    },
  };
}

export async function createTask(input: unknown): Promise<ActionResult<TaskItem>> {
  const parsed = createTaskInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const authenticated = await authenticatedClient();
  if (!authenticated) {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再创建任务" },
    };
  }

  const { data, error } = await authenticated.supabase
    .from("tasks")
    .insert({
      workspace_id: parsed.data.workspaceId,
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      priority: parsed.data.priority,
      assignee_id: parsed.data.assigneeId,
      created_by: authenticated.user.id,
    })
    .select(TASK_SELECT)
    .single();

  if (error || !data) return databaseError("create", error);

  revalidateWorkspace(parsed.data.workspaceId);
  return {
    ok: true,
    data: mapTaskRow(data as TaskRow, authenticated.supabase),
  };
}

export async function updateTask(input: unknown): Promise<ActionResult<TaskItem>> {
  const parsed = updateTaskInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const authenticated = await authenticatedClient();
  if (!authenticated) {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再修改任务" },
    };
  }

  const { data, error } = await authenticated.supabase
    .from("tasks")
    .update(patchToDatabase(parsed.data.patch))
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("id", parsed.data.taskId)
    .select(TASK_SELECT)
    .maybeSingle();

  if (error) return databaseError("update", error);
  if (!data) return databaseError("update", { code: "42501" });

  revalidateWorkspace(parsed.data.workspaceId);
  return {
    ok: true,
    data: mapTaskRow(data as TaskRow, authenticated.supabase),
  };
}

export async function deleteTask(input: unknown): Promise<ActionResult<string>> {
  const parsed = deleteTaskInputSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const authenticated = await authenticatedClient();
  if (!authenticated) {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再删除任务" },
    };
  }

  const { data, error } = await authenticated.supabase.functions.invoke(
    "delete-task",
    { body: parsed.data },
  );

  if (error) return edgeDeleteError(error);
  if (!data || data.taskId !== parsed.data.taskId) {
    return edgeDeleteError(null);
  }

  revalidateWorkspace(parsed.data.workspaceId);
  return { ok: true, data: data.taskId };
}
