import { z } from "zod";

const uuidSchema = z.string().uuid("标识格式不正确");

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "请输入评论内容")
  .max(2000, "评论不能超过 2000 个字符");

export const createCommentInputSchema = z.object({
  workspaceId: uuidSchema,
  taskId: uuidSchema,
  body: commentBodySchema,
});

export const deleteCommentInputSchema = z.object({
  workspaceId: uuidSchema,
  taskId: uuidSchema,
  commentId: uuidSchema,
});

export function getCommentFieldErrors(
  error: z.ZodError,
): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path.at(-1);

    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }

    return errors;
  }, {});
}
