import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceChanges } from "@/features/realtime/use-workspace-changes";

type Listener = {
  type: string;
  filter: Record<string, unknown>;
  callback: (payload: Record<string, unknown>) => void;
};

type SubscribeCallback = (status: string, error?: Error) => void;

const mocks = vi.hoisted(() => {
  const listeners: Listener[] = [];
  const channels: Array<{
    name: string;
    channel: {
      on: ReturnType<typeof vi.fn>;
      presenceState: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
      subscribe: ReturnType<typeof vi.fn>;
      track: ReturnType<typeof vi.fn>;
      untrack: ReturnType<typeof vi.fn>;
    };
    subscribeCallback: SubscribeCallback | null;
  }> = [];
  const client = {
    channel: vi.fn((name: string) => {
      const entry = {
        name,
        channel: {
          on: vi.fn(),
          presenceState: vi.fn(() => ({})),
          send: vi.fn().mockResolvedValue("ok"),
          subscribe: vi.fn(),
          track: vi.fn().mockResolvedValue("ok"),
          untrack: vi.fn().mockResolvedValue("ok"),
        },
        subscribeCallback: null as SubscribeCallback | null,
      };
      entry.channel.on.mockImplementation(
        (
          type: string,
          filter: Record<string, unknown>,
          callback: (payload: Record<string, unknown>) => void,
        ) => {
          listeners.push({ type, filter, callback });
          return entry.channel;
        },
      );
      entry.channel.subscribe.mockImplementation((callback: SubscribeCallback) => {
        entry.subscribeCallback = callback;
        return entry.channel;
      });
      channels.push(entry);
      return entry.channel;
    }),
    removeChannel: vi.fn().mockResolvedValue("ok"),
    from: vi.fn(),
    realtime: {
      setAuth: vi.fn().mockResolvedValue(undefined),
    },
  };

  return {
    channels,
    client,
    listeners,
    subscribe: (name: string, status: string, error?: Error) => {
      const callback = channels
        .toReversed()
        .find((entry) => entry.name === name)?.subscribeCallback;
      if (!callback) throw new Error(`缺少 ${name} 的订阅回调`);
      callback(status, error);
    },
    membershipResult: vi.fn(),
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mocks.client,
}));

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";

function useRealtime(currentWorkspaceId = workspaceId) {
  return useWorkspaceChanges({
    workspaceId: currentWorkspaceId,
    currentUserId: aliceId,
    currentUserDisplayName: "Alice",
    activeTaskId: taskId,
  });
}

function listener(
  type: string,
  tableOrEvent: string,
  event?: string,
) {
  const found = mocks.listeners.find(({ type: currentType, filter }) => {
    if (currentType !== type) return false;
    if (type === "broadcast" || type === "presence") {
      return filter.event === tableOrEvent;
    }
    return filter.table === tableOrEvent && filter.event === event;
  });
  if (!found) throw new Error(`缺少 ${type}:${tableOrEvent}:${event ?? ""} 监听器`);
  return found.callback;
}

describe("useWorkspaceChanges", () => {
  beforeEach(() => {
    mocks.listeners.length = 0;
    mocks.channels.length = 0;
    mocks.client.channel.mockClear();
    mocks.client.removeChannel.mockClear();
    mocks.client.realtime.setAuth.mockClear();
    mocks.membershipResult.mockReset();
    mocks.membershipResult.mockResolvedValue({
      data: { user_id: aliceId },
      error: null,
    });
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: mocks.membershipResult,
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    mocks.client.from.mockReset();
    mocks.client.from.mockReturnValue(builder);
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("subscribes to filtered inserts and updates plus private deletes", async () => {
    const { result } = renderHook(() => useRealtime());

    expect(result.current.status).toBe("connecting");
    await waitFor(() => expect(mocks.client.channel).toHaveBeenCalledTimes(2));

    expect(mocks.client.realtime.setAuth).toHaveBeenCalledTimes(1);
    expect(mocks.client.channel).toHaveBeenNthCalledWith(
      1,
      `workspace-postgres:${workspaceId}`,
    );
    expect(mocks.client.channel).toHaveBeenNthCalledWith(2, `workspace:${workspaceId}`, {
      config: { private: true, presence: { key: aliceId } },
    });
    expect(mocks.listeners.map(({ type, filter }) => ({ type, filter }))).toEqual([
      {
        type: "postgres_changes",
        filter: {
          event: "INSERT",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
      },
      {
        type: "postgres_changes",
        filter: {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
      },
      {
        type: "postgres_changes",
        filter: {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `workspace_id=eq.${workspaceId}`,
        },
      },
      {
        type: "postgres_changes",
        filter: {
          event: "UPDATE",
          schema: "public",
          table: "comments",
          filter: `workspace_id=eq.${workspaceId}`,
        },
      },
      { type: "presence", filter: { event: "sync" } },
      { type: "broadcast", filter: { event: "DELETE" } },
      { type: "broadcast", filter: { event: "typing" } },
    ]);
  });

  it("tracks presence and carries typing on the same private channel", async () => {
    const { result } = renderHook(() => useRealtime());
    await waitFor(() => expect(mocks.client.channel).toHaveBeenCalledTimes(2));
    const workspaceChannel = mocks.channels.find(
      ({ name }) => name === `workspace:${workspaceId}`,
    )!.channel;

    act(() => {
      mocks.subscribe(`workspace-postgres:${workspaceId}`, "SUBSCRIBED");
      mocks.subscribe(`workspace:${workspaceId}`, "SUBSCRIBED");
    });
    await waitFor(() => expect(workspaceChannel.track).toHaveBeenCalledTimes(1));
    expect(workspaceChannel.track).toHaveBeenCalledWith({
      userId: aliceId,
      displayName: "Alice",
      onlineAt: expect.any(String),
    });

    workspaceChannel.presenceState.mockReturnValue({
      alice: [
        {
          presence_ref: "alice",
          userId: aliceId,
          displayName: "Alice",
          onlineAt: "2026-07-11T00:00:00.000Z",
        },
      ],
      bob: [
        {
          presence_ref: "bob",
          userId: bobId,
          displayName: "Bob",
          onlineAt: "2026-07-11T00:00:01.000Z",
        },
      ],
    });
    act(() => listener("presence", "sync")({}));
    expect(result.current.onlineMembers.map(({ userId }) => userId)).toEqual([
      aliceId,
      bobId,
    ]);

    act(() => result.current.notifyTyping(true));
    expect(workspaceChannel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "typing",
      payload: { taskId, userId: aliceId, isTyping: true },
    });

    act(() =>
      listener("broadcast", "typing")({
        type: "broadcast",
        event: "typing",
        payload: { taskId, userId: bobId, isTyping: true },
      }),
    );
    expect(result.current.typingUserIds).toEqual([bobId]);
  });

  it("maps events into changes and ignores duplicate payloads", async () => {
    const { result } = renderHook(() => useRealtime());
    await waitFor(() => expect(mocks.client.channel).toHaveBeenCalledTimes(2));

    act(() => {
      mocks.subscribe(`workspace-postgres:${workspaceId}`, "SUBSCRIBED");
      mocks.subscribe(`workspace:${workspaceId}`, "SUBSCRIBED");
    });
    expect(result.current.status).toBe("connected");
    expect(result.current.resyncVersion).toBe(0);

    const handleInsert = listener("postgres_changes", "tasks", "INSERT");
    const payload = {
      eventType: "INSERT",
      new: { id: "22222222-2222-4222-8222-222222222222" },
      old: {},
      schema: "public",
      table: "tasks",
      commit_timestamp: "2026-07-11T01:00:00Z",
      errors: [],
    };
    act(() => handleInsert(payload));
    act(() => handleInsert(payload));

    expect(result.current.latestChange).toMatchObject({
      table: "tasks",
      eventType: "INSERT",
      id: "22222222-2222-4222-8222-222222222222",
    });
    expect(result.current.resyncVersion).toBe(1);

    act(() =>
      listener("broadcast", "DELETE")({
        type: "broadcast",
        event: "DELETE",
        payload: {
          table: "comments",
          id: "33333333-3333-4333-8333-333333333333",
        },
      }),
    );
    expect(result.current.latestChange).toEqual({
      table: "comments",
      eventType: "DELETE",
      id: "33333333-3333-4333-8333-333333333333",
      commitTimestamp: null,
    });
    expect(result.current.resyncVersion).toBe(2);
  });

  it("maps connection failures, browser connectivity and reconnection", async () => {
    const { result } = renderHook(() => useRealtime());
    await waitFor(() => expect(mocks.client.channel).toHaveBeenCalledTimes(2));

    act(() => {
      mocks.subscribe(`workspace-postgres:${workspaceId}`, "SUBSCRIBED");
      mocks.subscribe(`workspace:${workspaceId}`, "SUBSCRIBED");
    });
    act(() =>
      mocks.subscribe(
        `workspace-postgres:${workspaceId}`,
        "CHANNEL_ERROR",
        new Error("lost"),
      ),
    );
    expect(result.current.status).toBe("reconnecting");

    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current.status).toBe("disconnected");
    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current.status).toBe("reconnecting");
    await waitFor(() => expect(mocks.client.channel).toHaveBeenCalledTimes(4));

    act(() => {
      mocks.subscribe(`workspace-postgres:${workspaceId}`, "SUBSCRIBED");
      mocks.subscribe(`workspace:${workspaceId}`, "SUBSCRIBED");
    });
    expect(result.current.status).toBe("connected");
    expect(result.current.resyncVersion).toBe(1);
  });

  it("removes workspace channels after a permission error confirms membership loss", async () => {
    mocks.membershipResult.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() => useRealtime());
    await waitFor(() => expect(mocks.client.channel).toHaveBeenCalledTimes(2));

    act(() => {
      mocks.subscribe(`workspace-postgres:${workspaceId}`, "SUBSCRIBED");
      mocks.subscribe(`workspace:${workspaceId}`, "CHANNEL_ERROR");
    });

    await waitFor(() => expect(result.current.accessRevoked).toBe(true));
    expect(mocks.client.from).toHaveBeenCalledWith("workspace_members");
    await waitFor(() => expect(mocks.client.removeChannel).toHaveBeenCalledTimes(2));
    expect(result.current.onlineMembers).toEqual([]);
    expect(result.current.typingUserIds).toEqual([]);
  });

  it("removes the old channel when the workspace changes or unmounts", async () => {
    const { rerender, unmount } = renderHook(
      ({ currentWorkspaceId }) => useRealtime(currentWorkspaceId),
      { initialProps: { currentWorkspaceId: workspaceId } },
    );
    await waitFor(() => expect(mocks.client.channel).toHaveBeenCalledTimes(2));

    rerender({
      currentWorkspaceId: "44444444-4444-4444-8444-444444444444",
    });
    await waitFor(() => expect(mocks.client.removeChannel).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.client.channel).toHaveBeenCalledTimes(4));

    unmount();
    expect(mocks.client.removeChannel).toHaveBeenCalledTimes(4);
    expect(
      mocks.channels
        .filter(({ name }) => name.startsWith("workspace:"))
        .every(({ channel }) => channel.untrack.mock.calls.length === 1),
    ).toBe(true);
  });
});
