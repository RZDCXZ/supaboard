import { describe, expect, it, vi } from "vitest";

import { getTaskComments } from "@/features/comments/queries";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const authorId = "33333333-3333-4333-8333-333333333333";

describe("comment queries", () => {
  it("loads one task timeline in stable chronological order", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order
      .mockReturnValueOnce(builder)
      .mockResolvedValueOnce({
        data: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            task_id: taskId,
            workspace_id: workspaceId,
            author_id: authorId,
            body: "Hello",
            created_at: "2026-07-10T01:00:00Z",
            updated_at: "2026-07-10T01:00:00Z",
            author: {
              id: authorId,
              display_name: "Alice",
              avatar_path: `${authorId}/avatar.webp`,
            },
          },
        ],
        error: null,
      });
    const supabase = {
      from: vi.fn(() => builder),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://storage.test/${path}` },
          })),
        })),
      },
    };

    await expect(
      getTaskComments(supabase as never, workspaceId, taskId),
    ).resolves.toEqual([
      {
        id: "44444444-4444-4444-8444-444444444444",
        taskId,
        workspaceId,
        author: {
          id: authorId,
          displayName: "Alice",
          avatarUrl: `https://storage.test/${authorId}/avatar.webp`,
        },
        body: "Hello",
        createdAt: "2026-07-10T01:00:00Z",
        updatedAt: "2026-07-10T01:00:00Z",
      },
    ]);
    expect(builder.eq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(builder.eq).toHaveBeenNthCalledWith(2, "task_id", taskId);
    expect(builder.order).toHaveBeenNthCalledWith(1, "created_at", {
      ascending: true,
    });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", {
      ascending: true,
    });
  });
});
