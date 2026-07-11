import { describe, expect, it, vi } from "vitest";

import {
  getTaskAttachments,
  mapAttachmentRow,
} from "@/features/storage/attachments/queries";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";

function attachmentRow() {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    task_id: taskId,
    workspace_id: workspaceId,
    uploader_id: aliceId,
    file_name: "notes.txt",
    content_type: "text/plain",
    size_bytes: 12,
    created_at: "2026-07-11T00:00:00Z",
    uploader: {
      id: aliceId,
      display_name: "Alice",
      avatar_path: `${aliceId}/avatar.png`,
    },
  };
}

describe("attachment queries", () => {
  it("maps uploader display data and delete capability without exposing object paths", () => {
    const supabase = {
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://avatar.test/a" } })),
        })),
      },
    };

    expect(
      mapAttachmentRow(attachmentRow(), supabase as never, aliceId, "member"),
    ).toEqual({
      id: "44444444-4444-4444-8444-444444444444",
      taskId,
      workspaceId,
      uploader: {
        id: aliceId,
        displayName: "Alice",
        avatarUrl: "https://avatar.test/a",
      },
      fileName: "notes.txt",
      contentType: "text/plain",
      sizeBytes: 12,
      createdAt: "2026-07-11T00:00:00Z",
      canDelete: true,
    });
  });

  it("lets an Owner delete another member attachment", () => {
    const supabase = {
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://avatar.test/a" } })),
        })),
      },
    };

    expect(
      mapAttachmentRow(attachmentRow(), supabase as never, "other-user", "owner")
        .canDelete,
    ).toBe(true);
  });

  it("queries the task metadata list in stable chronological order", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order
      .mockReturnValueOnce(builder)
      .mockResolvedValueOnce({ data: [attachmentRow()], error: null });
    const supabase = {
      from: vi.fn(() => builder),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://avatar.test/a" } })),
        })),
      },
    };

    const result = await getTaskAttachments(
      supabase as never,
      workspaceId,
      taskId,
      aliceId,
      "member",
    );

    expect(builder.eq).toHaveBeenNthCalledWith(1, "workspace_id", workspaceId);
    expect(builder.eq).toHaveBeenNthCalledWith(2, "task_id", taskId);
    expect(builder.order).toHaveBeenNthCalledWith(1, "created_at", {
      ascending: true,
    });
    expect(builder.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(result).toHaveLength(1);
  });
});
