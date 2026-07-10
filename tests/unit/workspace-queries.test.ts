import { expect, test, vi } from "vitest";

import { getWorkspaceById } from "@/features/workspaces/queries";

test("getWorkspaceById derives the current role from the protected workspace row", async () => {
  const ownerId = "33333333-3333-4333-8333-333333333333";
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({
    data: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Alpha",
      owner_id: ownerId,
      updated_at: "2026-07-10T00:00:00Z",
    },
    error: null,
  });
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: ownerId } }, error: null }),
    },
    from: vi.fn(() => builder),
  };

  await expect(getWorkspaceById(supabase as never, "workspace-1")).resolves.toEqual({
    id: "11111111-1111-4111-8111-111111111111",
    name: "Alpha",
    role: "owner",
    updatedAt: "2026-07-10T00:00:00Z",
  });
});
