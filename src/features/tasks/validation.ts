import { z } from "zod";

const uuidSchema = z.string().uuid("标识格式不正确");

export const taskTitleSchema = z
  .string()
  .trim()
  .min(1, "请输入任务标题")
  .max(200, "任务标题不能超过 200 个字符");

export const taskDescriptionSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, context) => {
    if (value === null || value === undefined || value.trim() === "") {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length > 5000) {
      context.addIssue({
        code: "custom",
        message: "任务描述不能超过 5000 个字符",
      });
      return z.NEVER;
    }

    return trimmed;
  });

const nullableAssigneeSchema = z
  .union([uuidSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);
const taskPrioritySchema = z.enum(["low", "medium", "high"]);

export const createTaskInputSchema = z.object({
  workspaceId: uuidSchema,
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  status: taskStatusSchema.default("todo"),
  priority: taskPrioritySchema.default("medium"),
  assigneeId: nullableAssigneeSchema,
});

const taskPatchSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("title"), value: taskTitleSchema }),
  z.object({ field: z.literal("description"), value: taskDescriptionSchema }),
  z.object({ field: z.literal("status"), value: taskStatusSchema }),
  z.object({ field: z.literal("priority"), value: taskPrioritySchema }),
  z.object({ field: z.literal("assigneeId"), value: nullableAssigneeSchema }),
]);

export const updateTaskInputSchema = z.object({
  workspaceId: uuidSchema,
  taskId: uuidSchema,
  patch: taskPatchSchema,
});

export const deleteTaskInputSchema = z.object({
  workspaceId: uuidSchema,
  taskId: uuidSchema,
});

export function getTaskFieldErrors(error: z.ZodError): Record<string, string> {
  return error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path.at(-1);

    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }

    return errors;
  }, {});
}
