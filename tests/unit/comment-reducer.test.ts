import { describe, expect, it } from "vitest";

import { commentReducer } from "@/features/comments/reducer";
import type { CommentItem } from "@/features/comments/types";

function comment(id: string, createdAt: string, body = id): CommentItem {
  return {
    id,
    taskId: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    author: {
      id: "33333333-3333-4333-8333-333333333333",
      displayName: "Alice",
      avatarUrl: null,
    },
    body,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("commentReducer", () => {
  it("replaces comments in deterministic chronological order", () => {
    const next = commentReducer([], {
      type: "replace",
      comments: [
        comment("b", "2026-07-11T02:00:00Z"),
        comment("a", "2026-07-11T01:00:00Z"),
      ],
    });

    expect(next.map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("upserts without duplicates", () => {
    const next = commentReducer(
      [comment("a", "2026-07-11T01:00:00Z", "Old")],
      {
        type: "upsert",
        comment: comment("a", "2026-07-11T01:00:00Z", "New"),
      },
    );

    expect(next).toHaveLength(1);
    expect(next[0]?.body).toBe("New");
  });

  it("removes comments using only the primary key", () => {
    const next = commentReducer(
      [
        comment("a", "2026-07-11T01:00:00Z"),
        comment("b", "2026-07-11T02:00:00Z"),
      ],
      { type: "remove", commentId: "a" },
    );

    expect(next.map(({ id }) => id)).toEqual(["b"]);
  });
});
