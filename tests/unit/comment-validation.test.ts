import { describe, expect, it } from "vitest";

import {
  createCommentInputSchema,
  deleteCommentInputSchema,
  getCommentFieldErrors,
} from "@/features/comments/validation";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const commentId = "33333333-3333-4333-8333-333333333333";

describe("comment validation", () => {
  it("trims a valid comment body", () => {
    expect(
      createCommentInputSchema.parse({ workspaceId, taskId, body: "  Hello  " }),
    ).toEqual({ workspaceId, taskId, body: "Hello" });
  });

  it("rejects blank and overlong comments with field errors", () => {
    const blank = createCommentInputSchema.safeParse({
      workspaceId,
      taskId,
      body: "   ",
    });
    const overlong = createCommentInputSchema.safeParse({
      workspaceId,
      taskId,
      body: "x".repeat(2001),
    });

    expect(blank.success).toBe(false);
    expect(overlong.success).toBe(false);
    if (!blank.success) {
      expect(getCommentFieldErrors(blank.error)).toEqual({
        body: "请输入评论内容",
      });
    }
    if (!overlong.success) {
      expect(getCommentFieldErrors(overlong.error)).toEqual({
        body: "评论不能超过 2000 个字符",
      });
    }
  });

  it("requires workspace, task and comment UUIDs for deletion", () => {
    expect(
      deleteCommentInputSchema.parse({ workspaceId, taskId, commentId }),
    ).toEqual({ workspaceId, taskId, commentId });
    expect(
      deleteCommentInputSchema.safeParse({
        workspaceId: "nope",
        taskId,
        commentId,
      }).success,
    ).toBe(false);
  });
});
