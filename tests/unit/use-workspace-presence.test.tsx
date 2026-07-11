import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useWorkspacePresence } from "@/features/realtime/use-workspace-presence";

const aliceId = "11111111-1111-4111-8111-111111111111";
const bobId = "22222222-2222-4222-8222-222222222222";

describe("useWorkspacePresence", () => {
  it("builds a minimal presence payload", () => {
    const { result } = renderHook(() =>
      useWorkspacePresence({
        currentUserId: aliceId,
        currentUserDisplayName: "Alice",
      }),
    );

    const payload = result.current.createPresencePayload();

    expect(Object.keys(payload).toSorted()).toEqual([
      "displayName",
      "onlineAt",
      "userId",
    ]);
    expect(payload).toMatchObject({ userId: aliceId, displayName: "Alice" });
    expect(Number.isNaN(Date.parse(payload.onlineAt))).toBe(false);
  });

  it("normalizes malformed state and deduplicates multiple connections", () => {
    const { result } = renderHook(() =>
      useWorkspacePresence({
        currentUserId: aliceId,
        currentUserDisplayName: "Alice",
      }),
    );

    act(() => {
      result.current.syncPresence({
        first: [
          {
            presence_ref: "alice-old",
            userId: aliceId,
            displayName: "Alice old",
            onlineAt: "2026-07-11T00:00:00.000Z",
          },
          {
            presence_ref: "alice-new",
            userId: aliceId,
            displayName: "Alice",
            onlineAt: "2026-07-11T00:01:00.000Z",
          },
        ],
        second: [
          {
            presence_ref: "bob",
            userId: bobId,
            displayName: "Bob",
            onlineAt: "2026-07-11T00:02:00.000Z",
          },
          {
            presence_ref: "invalid",
            userId: "not-a-uuid",
            displayName: "Invalid",
            onlineAt: "never",
          },
        ],
      });
    });

    expect(result.current.onlineMembers).toEqual([
      {
        userId: aliceId,
        displayName: "Alice",
        onlineAt: "2026-07-11T00:01:00.000Z",
      },
      {
        userId: bobId,
        displayName: "Bob",
        onlineAt: "2026-07-11T00:02:00.000Z",
      },
    ]);
  });

  it("clears stale presence state", () => {
    const { result } = renderHook(() =>
      useWorkspacePresence({
        currentUserId: aliceId,
        currentUserDisplayName: "Alice",
      }),
    );

    act(() => {
      result.current.syncPresence({
        alice: [
          {
            presence_ref: "alice",
            userId: aliceId,
            displayName: "Alice",
            onlineAt: "2026-07-11T00:00:00.000Z",
          },
        ],
      });
      result.current.clearPresence();
    });

    expect(result.current.onlineMembers).toEqual([]);
  });
});
