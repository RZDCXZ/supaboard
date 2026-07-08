import { z } from "zod";

import type { AuthFieldErrors, AuthFieldName } from "./types";

const authFieldNames = new Set<AuthFieldName>([
  "email",
  "password",
  "confirmPassword",
]);

export function getAuthFieldErrors(error: z.ZodError): AuthFieldErrors {
  return error.issues.reduce<AuthFieldErrors>((errors, issue) => {
    const field = issue.path[0];

    if (
      typeof field === "string" &&
      authFieldNames.has(field as AuthFieldName) &&
      !errors[field as AuthFieldName]
    ) {
      errors[field as AuthFieldName] = issue.message;
    }

    return errors;
  }, {});
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("请输入有效的邮箱地址"));

export const passwordSchema = z
  .string()
  .min(8, "密码至少需要 8 个字符")
  .max(72, "密码不能超过 72 个字符");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = loginSchema
  .extend({
    confirmPassword: passwordSchema,
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });
