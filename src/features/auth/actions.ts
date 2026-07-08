"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { getSafeNextPath } from "./redirect";
import type { AuthActionState } from "./types";
import {
  forgotPasswordSchema,
  getAuthFieldErrors,
  loginSchema,
  signupSchema,
  updatePasswordSchema,
} from "./validation";

function validationError(error?: Parameters<typeof getAuthFieldErrors>[0]): AuthActionState {
  return {
    status: "error",
    message: "请检查输入后重试",
    fieldErrors: error ? getAuthFieldErrors(error) : undefined,
  };
}

async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (origin) {
    return origin;
  }

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function login(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", message: "邮箱或密码不正确" };
  }

  redirect(getSafeNextPath(formData.get("next")?.toString() ?? null));
}

export async function signup(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const callbackUrl = new URL("/auth/callback", await getRequestOrigin());
  callbackUrl.searchParams.set("next", "/app");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: callbackUrl.toString() },
  });

  if (error) {
    return { status: "error", message: "暂时无法注册，请稍后重试" };
  }

  if (data.session) {
    redirect("/app");
  }

  return { status: "success" };
}

export async function requestPasswordReset(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const callbackUrl = new URL("/auth/callback", await getRequestOrigin());
  callbackUrl.searchParams.set("next", "/update-password");

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl.toString(),
  });

  const [localPart = "", domain = ""] = parsed.data.email.split("@");
  const emailHint = `${localPart.slice(0, 2)}***@${domain}`;

  return { status: "success", emailHint };
}

export async function updatePassword(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: "密码更新失败，请重新发送恢复邮件",
    };
  }

  redirect("/app");
}

export async function signInWithGitHub(): Promise<void> {
  const callbackUrl = new URL("/auth/callback", await getRequestOrigin());
  callbackUrl.searchParams.set("next", "/app");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
