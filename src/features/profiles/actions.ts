"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import type { ProfileActionState } from "./types";
import { isOwnedAvatarPath, updateDisplayNameSchema } from "./validation";

function authenticationError(): ProfileActionState {
  return {
    status: "error",
    code: "NOT_AUTHENTICATED",
    message: "请先登录后再修改个人资料",
  };
}

function databaseError(code?: string): ProfileActionState {
  if (code === "42501") {
    return {
      status: "error",
      code: "FORBIDDEN",
      message: "你没有权限修改此个人资料",
    };
  }

  return {
    status: "error",
    code: "INTERNAL_ERROR",
    message: "暂时无法保存个人资料，请稍后重试",
  };
}

export async function updateDisplayName(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const parsed = updateDisplayNameSchema.safeParse({
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: "请检查输入后重试",
      fieldErrors: {
        displayName:
          parsed.error.issues.find((issue) => issue.path[0] === "displayName")
            ?.message ?? "昵称无效",
      },
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return authenticationError();

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return databaseError(error.code);

  revalidatePath("/app", "layout");
  return { status: "success", message: "昵称已保存" };
}

export async function updateAvatarPath(
  avatarPath: string,
): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return authenticationError();

  if (!isOwnedAvatarPath(user.id, avatarPath)) {
    return {
      status: "error",
      code: "VALIDATION_ERROR",
      message: "头像路径无效，请重新选择图片",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_path: avatarPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return databaseError(error.code);

  revalidatePath("/app", "layout");
  return { status: "success", message: "头像已更新" };
}
