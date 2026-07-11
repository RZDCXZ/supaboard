import { describe, expect, it, vi } from "vitest";

import {
  getWorkspaceMembers,
  MemberQueryError,
} from "@/features/members/queries";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";

describe("member queries", () => {
  it("selects only public member fields and applies stable owner-first ordering", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order
      .mockReturnValueOnce(builder)
      .mockReturnValueOnce(builder)
      .mockResolvedValueOnce({
        data: [
          {
            user_id: aliceId,
            role: "owner",
            joined_at: "2026-07-10T00:00:00Z",
            profiles: {
              id: aliceId,
              display_name: "Alice",
              avatar_path: null,
            },
          },
          {
            user_id: bobId,
            role: "member",
            joined_at: "2026-07-10T00:01:00Z",
            profiles: {
              id: bobId,
              display_name: "Bob",
              avatar_path: `${bobId}/avatar.png`,
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
      getWorkspaceMembers(supabase as never, workspaceId),
    ).resolves.toEqual([
      {
        id: aliceId,
        displayName: "Alice",
        avatarUrl: null,
        role: "owner",
        joinedAt: "2026-07-10T00:00:00Z",
      },
      {
        id: bobId,
        displayName: "Bob",
        avatarUrl: `https://storage.test/${bobId}/avatar.png`,
        role: "member",
        joinedAt: "2026-07-10T00:01:00Z",
      },
    ]);

    expect(supabase.from).toHaveBeenCalledWith("workspace_members");
    expect(builder.eq).toHaveBeenCalledWith("workspace_id", workspaceId);
    expect(builder.order).toHaveBeenNthCalledWith(1, "role", {
      ascending: false,
    });
    expect(builder.order).toHaveBeenNthCalledWith(2, "joined_at", {
      ascending: true,
    });
    expect(builder.order).toHaveBeenNthCalledWith(3, "user_id", {
      ascending: true,
    });
    expect(builder.select.mock.calls[0]?.[0]).not.toContain("email");
  });

  it("maps Data API failures to a stable query error", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order
      .mockReturnValueOnce(builder)
      .mockReturnValueOnce(builder)
      .mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    const supabase = { from: vi.fn(() => builder) };

    await expect(
      getWorkspaceMembers(supabase as never, workspaceId),
    ).rejects.toBeInstanceOf(MemberQueryError);
  });
});
