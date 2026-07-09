"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import type { WorkspaceActionState } from "./types";
import { createWorkspaceSchema, getWorkspaceFieldErrors } from "./validation";

function validationError(error?: Parameters<typeof getWorkspaceFieldErrors>[0]): WorkspaceActionState {
  return {
    status: "error",
    code: "VALIDATION_ERROR",
    message: "请检查输入后重试",
    fieldErrors: error ? getWorkspaceFieldErrors(error) : undefined,
  };
}

function databaseError(code?: string): WorkspaceActionState {
  if (code === "42501") {
    return {
      status: "error",
      code: "FORBIDDEN",
      message: "你没有权限执行此操作",
    };
  }

  if (code === "23505") {
    return {
      status: "error",
      code: "CONFLICT",
      message: "工作区状态已变化，请刷新后重试",
    };
  }

  return {
    status: "error",
    code: "INTERNAL_ERROR",
    message: "暂时无法创建工作区，请稍后重试",
  };
}

export async function createWorkspace(
  _previousState: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "error",
      code: "NOT_AUTHENTICATED",
      message: "请先登录后再创建工作区",
    };
  }

  const { data: workspaceId, error } = await supabase.rpc("create_workspace", {
    name: parsed.data.name,
  });

  if (error || !workspaceId) {
    return databaseError(error?.code);
  }

  revalidatePath("/app");
  redirect(`/app/workspaces/${workspaceId}`);
}
