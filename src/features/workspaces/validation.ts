import { z } from "zod";

import type { WorkspaceFieldErrors } from "./types";

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(1, "请输入工作区名称")
  .max(100, "工作区名称不能超过 100 个字符");

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});

export function getWorkspaceFieldErrors(error: z.ZodError): WorkspaceFieldErrors {
  return error.issues.reduce<WorkspaceFieldErrors>((errors, issue) => {
    const field = issue.path[0];

    if (field === "name" && !errors.name) {
      errors.name = issue.message;
    }

    return errors;
  }, {});
}
