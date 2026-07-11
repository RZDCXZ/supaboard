import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommentSection } from "@/features/comments/comment-section";
import type { CommentItem } from "@/features/comments/types";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";

const mocks = vi.hoisted(() => ({
  createComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("@/features/comments/actions", () => ({
  createComment: mocks.createComment,
  deleteComment: mocks.deleteComment,
}));

function comment(
  id: string,
  authorId: string,
  displayName: string,
  body: string,
): CommentItem {
  return {
    id,
    taskId,
    workspaceId,
    author: { id: authorId, displayName, avatarUrl: null },
    body,
    createdAt: "2026-07-10T01:00:00Z",
    updatedAt: "2026-07-10T01:00:00Z",
  };
}

describe("CommentSection", () => {
  beforeEach(() => {
    mocks.createComment.mockReset();
    mocks.deleteComment.mockReset();
  });

  it("shows delete actions only for the author when the viewer is a member", () => {
    render(
      <CommentSection
        workspaceId={workspaceId}
        taskId={taskId}
        comments={[
          comment("55555555-5555-4555-8555-555555555555", aliceId, "Alice", "A"),
          comment("66666666-6666-4666-8666-666666666666", bobId, "Bob", "B"),
        ]}
        currentUserId={bobId}
        workspaceRole="member"
      />,
    );

    expect(
      screen.queryByRole("button", { name: "删除 Alice 的评论" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "删除 Bob 的评论" }),
    ).toBeVisible();
  });

  it("allows an owner to delete any comment", () => {
    render(
      <CommentSection
        workspaceId={workspaceId}
        taskId={taskId}
        comments={[
          comment("55555555-5555-4555-8555-555555555555", aliceId, "Alice", "A"),
        ]}
        currentUserId={bobId}
        workspaceRole="owner"
      />,
    );

    expect(
      screen.getByRole("button", { name: "删除 Alice 的评论" }),
    ).toBeVisible();
  });

  it("submits a comment, updates the list and clears the input", async () => {
    const created = comment(
      "77777777-7777-4777-8777-777777777777",
      bobId,
      "Bob",
      "New",
    );
    mocks.createComment.mockResolvedValue({ ok: true, data: created });

    render(
      <CommentSection
        workspaceId={workspaceId}
        taskId={taskId}
        comments={[]}
        currentUserId={bobId}
        workspaceRole="member"
      />,
    );

    const input = screen.getByRole("textbox", { name: "评论" });
    fireEvent.change(input, { target: { value: " New " } });
    expect(screen.getByText("5 / 2000")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "发表评论" }));

    await waitFor(() =>
      expect(mocks.createComment).toHaveBeenCalledWith({
        workspaceId,
        taskId,
        body: " New ",
      }),
    );
    expect(await screen.findByText("New")).toBeVisible();
    expect(input).toHaveValue("");
  });

  it("keeps task editing available when comments fail to load", () => {
    render(
      <CommentSection
        workspaceId={workspaceId}
        taskId={taskId}
        comments={[]}
        commentsError
        currentUserId={bobId}
        workspaceRole="member"
      />,
    );

    expect(screen.getByText("评论加载失败")).toBeVisible();
    expect(screen.getByRole("button", { name: "发表评论" })).toBeVisible();
  });

  it("reconciles refreshed comments and removes a realtime delete by id", () => {
    const first = comment(
      "55555555-5555-4555-8555-555555555555",
      aliceId,
      "Alice",
      "First",
    );
    const second = comment(
      "66666666-6666-4666-8666-666666666666",
      bobId,
      "Bob",
      "Second",
    );
    const { rerender } = render(
      <CommentSection
        workspaceId={workspaceId}
        taskId={taskId}
        comments={[first]}
        realtimeChange={null}
        currentUserId={bobId}
        workspaceRole="member"
      />,
    );

    rerender(
      <CommentSection
        workspaceId={workspaceId}
        taskId={taskId}
        comments={[first, second]}
        realtimeChange={null}
        currentUserId={bobId}
        workspaceRole="member"
      />,
    );
    expect(screen.getByText("Second")).toBeVisible();

    rerender(
      <CommentSection
        workspaceId={workspaceId}
        taskId={taskId}
        comments={[first, second]}
        realtimeChange={{
          table: "comments",
          eventType: "DELETE",
          id: second.id,
          commitTimestamp: null,
        }}
        currentUserId={bobId}
        workspaceRole="member"
      />,
    );
    expect(screen.queryByText("Second")).not.toBeInTheDocument();
  });

  it("shows remote typing and reports local input activity", () => {
    const onTypingChange = vi.fn();
    render(
      <CommentSection
        workspaceId={workspaceId}
        taskId={taskId}
        comments={[]}
        currentUserId={aliceId}
        workspaceRole="owner"
        typingMembers={[{ id: bobId, displayName: "Bob" }]}
        onTypingChange={onTypingChange}
      />,
    );

    expect(screen.getByRole("status", { name: "评论输入状态" })).toHaveTextContent(
      "Bob 正在输入",
    );

    const input = screen.getByRole("textbox", { name: "评论" });
    fireEvent.change(input, { target: { value: "Hello" } });
    expect(onTypingChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(input, { target: { value: "" } });
    expect(onTypingChange).toHaveBeenLastCalledWith(false);
  });
});
