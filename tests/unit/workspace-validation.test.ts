import { describe, expect, it } from "vitest";

import {
  createWorkspaceSchema,
  getWorkspaceFieldErrors,
  workspaceNameSchema,
} from "@/features/workspaces/validation";

describe("Workspace input validation", () => {
  it("trims valid workspace names", () => {
    expect(workspaceNameSchema.parse("  Alpha  ")).toBe("Alpha");
  });

  it("rejects blank workspace names", () => {
    const result = createWorkspaceSchema.safeParse({ name: "   " });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getWorkspaceFieldErrors(result.error)).toEqual({
        name: "请输入工作区名称",
      });
    }
  });

  it("limits workspace names to 100 characters", () => {
    const result = createWorkspaceSchema.safeParse({ name: "a".repeat(101) });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(getWorkspaceFieldErrors(result.error)).toEqual({
        name: "工作区名称不能超过 100 个字符",
      });
    }
  });
});
