"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type {
  AddedWorkspaceMember,
  MemberActionErrorCode,
  MemberActionResult,
} from "./types";

const addMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(320),
});

const removeMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
});

type EdgeErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

function revalidateWorkspace(workspaceId: string) {
  revalidatePath(`/app/workspaces/${workspaceId}`);
}

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error || !user ? null : { supabase, user };
}

async function parseEdgeError(error: unknown): Promise<EdgeErrorPayload | null> {
  const context =
    typeof error === "object" && error && "context" in error
      ? error.context
      : null;
  if (!(context instanceof Response)) return null;

  try {
    return (await context.json()) as EdgeErrorPayload;
  } catch {
    return null;
  }
}

function knownEdgeError(
  payload: EdgeErrorPayload | null,
): MemberActionResult<never> | null {
  const code = payload?.error?.code;
  const knownCodes: MemberActionErrorCode[] = [
    "VALIDATION_ERROR",
    "NOT_AUTHENTICATED",
    "FORBIDDEN",
    "USER_NOT_FOUND",
    "MEMBER_ALREADY_EXISTS",
  ];
  if (!knownCodes.includes(code as MemberActionErrorCode)) return null;

  return {
    ok: false,
    error: {
      code: code as MemberActionErrorCode,
      message: payload?.error?.message ?? "暂时无法添加成员，请稍后重试",
    },
  };
}

export async function addWorkspaceMember(
  input: unknown,
): Promise<MemberActionResult<AddedWorkspaceMember>> {
  const parsed = addMemberSchema.safeParse(input);
  if (!parsed.success) {
    const emailInvalid = parsed.error.issues.some(
      (issue) => issue.path[0] === "email",
    );
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "请检查成员邮箱后重试",
        fields: emailInvalid ? { email: "请输入有效的邮箱地址" } : undefined,
      },
    };
  }

  const authenticated = await authenticatedClient();
  if (!authenticated) {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再添加成员" },
    };
  }

  const { data, error } = await authenticated.supabase.functions.invoke(
    "add-member-by-email",
    { body: parsed.data },
  );
  if (error) {
    const payload = await parseEdgeError(error);
    const known = knownEdgeError(payload);
    if (known) return known;

    console.error("add-member-by-email Edge Function failed", {
      code: payload?.error?.code,
      requestId: payload?.error?.requestId,
    });
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "暂时无法添加成员，请稍后重试",
      },
    };
  }

  const member = data?.member;
  if (
    !member ||
    typeof member.userId !== "string" ||
    member.role !== "member"
  ) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "暂时无法添加成员，请稍后重试",
      },
    };
  }

  revalidateWorkspace(parsed.data.workspaceId);
  return { ok: true, data: member as AddedWorkspaceMember };
}

export async function removeWorkspaceMember(
  input: unknown,
): Promise<MemberActionResult<string>> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "成员信息不正确" },
    };
  }

  const authenticated = await authenticatedClient();
  if (!authenticated) {
    return {
      ok: false,
      error: { code: "NOT_AUTHENTICATED", message: "请先登录后再移除成员" },
    };
  }

  const { data, error } = await authenticated.supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", parsed.data.userId)
    .eq("role", "member")
    .select("user_id")
    .maybeSingle();

  if (error?.code === "42501") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "成员不存在、不能移除 Owner，或你没有管理权限",
      },
    };
  }
  if (error) {
    console.error("remove workspace member failed", { code: error.code });
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "暂时无法移除成员，请稍后重试" },
    };
  }
  if (!data) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "成员不存在、不能移除 Owner，或你没有管理权限",
      },
    };
  }

  revalidateWorkspace(parsed.data.workspaceId);
  return { ok: true, data: data.user_id };
}
