"use client";

import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

import {
  initialWorkspaceChangeState,
  type WorkspaceChangeTable,
  workspaceChangeReducer,
} from "./reducer";
import {
  type CommentTypingPayload,
  useCommentTyping,
} from "./use-comment-typing";
import {
  type WorkspacePresencePayload,
  useWorkspacePresence,
} from "./use-workspace-presence";

export type WorkspaceRealtimeStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
type ChangeRow = TaskRow | CommentRow;
type PostgresPayload =
  | RealtimePostgresInsertPayload<ChangeRow>
  | RealtimePostgresUpdatePayload<ChangeRow>;

type DeleteBroadcastPayload = {
  table?: unknown;
  id?: unknown;
};

type ChannelKind = "postgres" | "workspace";

export function useWorkspaceChanges({
  workspaceId,
  currentUserId,
  currentUserDisplayName,
  activeTaskId,
}: {
  workspaceId: string;
  currentUserId: string;
  currentUserDisplayName: string;
  activeTaskId: string | null;
}) {
  const [changeState, dispatch] = useReducer(
    workspaceChangeReducer,
    initialWorkspaceChangeState,
  );
  const [status, setStatus] =
    useState<WorkspaceRealtimeStatus>("connecting");
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [revokedWorkspaceId, setRevokedWorkspaceId] = useState<string | null>(
    null,
  );
  const hasConnectedRef = useRef(false);
  const workspaceChannelRef = useRef<RealtimeChannel | null>(null);
  const workspaceChannelSubscribedRef = useRef(false);
  const handleTypingEventRef = useRef<(payload: unknown) => void>(() => undefined);
  const {
    onlineMembers,
    createPresencePayload,
    syncPresence,
    clearPresence,
  } = useWorkspacePresence({ currentUserId, currentUserDisplayName });
  const sendTyping = useCallback((payload: CommentTypingPayload) => {
    if (!workspaceChannelSubscribedRef.current) return;

    const channel = workspaceChannelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: "typing", payload });
  }, []);
  const { typingUserIds, notifyTyping, handleTypingEvent, clearTyping } =
    useCommentTyping({
      taskId: activeTaskId,
      currentUserId,
      sendTyping,
    });

  useEffect(() => {
    handleTypingEventRef.current = handleTypingEvent;
  }, [handleTypingEvent]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let postgresChannel: RealtimeChannel | null = null;
    let workspaceChannel: RealtimeChannel | null = null;
    let accessRevocationHandled = false;
    const subscribed: Record<ChannelKind, boolean> = {
      postgres: false,
      workspace: false,
    };

    function handlePostgresChange(
      table: WorkspaceChangeTable,
      payload: PostgresPayload,
    ) {
      dispatch({
        table,
        eventType: payload.eventType,
        id: payload.new.id,
        commitTimestamp: payload.commit_timestamp,
      });
    }

    function handleDelete(payload: { payload?: DeleteBroadcastPayload }) {
      dispatch({
        table: payload.payload?.table,
        eventType: "DELETE",
        id: payload.payload?.id,
        commitTimestamp: null,
      });
    }

    function handleOffline() {
      subscribed.postgres = false;
      subscribed.workspace = false;
      workspaceChannelSubscribedRef.current = false;
      clearPresence();
      clearTyping();
      setStatus("disconnected");
    }

    function handleOnline() {
      setStatus("reconnecting");
      setConnectionEpoch((current) => current + 1);
    }

    async function checkWorkspaceAccess() {
      if (!active || accessRevocationHandled) return;

      const { data, error } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", currentUserId)
        .maybeSingle();
      if (!active || error || data) return;

      accessRevocationHandled = true;
      workspaceChannelSubscribedRef.current = false;
      workspaceChannelRef.current = null;
      clearPresence();
      clearTyping();
      setStatus("disconnected");
      setRevokedWorkspaceId(workspaceId);
      if (postgresChannel) void supabase.removeChannel(postgresChannel);
      if (workspaceChannel) {
        void workspaceChannel.untrack();
        void supabase.removeChannel(workspaceChannel);
      }
    }

    function handleChannelStatus(kind: ChannelKind, nextStatus: string) {
      if (!active) return;

      if (nextStatus === "SUBSCRIBED") {
        if (subscribed[kind]) return;
        subscribed[kind] = true;
        if (kind === "workspace") workspaceChannelSubscribedRef.current = true;

        if (subscribed.postgres && subscribed.workspace) {
          setStatus("connected");
          if (hasConnectedRef.current) {
            setReconnectVersion((current) => current + 1);
          } else {
            hasConnectedRef.current = true;
          }
        } else {
          setStatus(hasConnectedRef.current ? "reconnecting" : "connecting");
        }
        return;
      }

      subscribed[kind] = false;
      if (kind === "workspace") {
        workspaceChannelSubscribedRef.current = false;
        clearPresence();
        clearTyping();
        if (nextStatus === "CHANNEL_ERROR") void checkWorkspaceAccess();
      }
      if (nextStatus === "CLOSED") {
        setStatus("disconnected");
        return;
      }

      setStatus(window.navigator.onLine ? "reconnecting" : "disconnected");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (!window.navigator.onLine) {
      queueMicrotask(() => {
        if (active && !window.navigator.onLine) setStatus("disconnected");
      });
    } else {
      void (async () => {
        try {
          await supabase.realtime.setAuth();
          if (!active) return;

          const filter = `workspace_id=eq.${workspaceId}`;
          postgresChannel = supabase
            .channel(`workspace-postgres:${workspaceId}`, {
              config: { private: true },
            })
            .on<TaskRow>(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "tasks", filter },
              (payload) => handlePostgresChange("tasks", payload),
            )
            .on<TaskRow>(
              "postgres_changes",
              { event: "UPDATE", schema: "public", table: "tasks", filter },
              (payload) => handlePostgresChange("tasks", payload),
            )
            .on<CommentRow>(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "comments", filter },
              (payload) => handlePostgresChange("comments", payload),
            )
            .on<CommentRow>(
              "postgres_changes",
              { event: "UPDATE", schema: "public", table: "comments", filter },
              (payload) => handlePostgresChange("comments", payload),
            )
            .subscribe((nextStatus) =>
              handleChannelStatus("postgres", nextStatus),
            );

          workspaceChannel = supabase
            .channel(`workspace:${workspaceId}`, {
              config: {
                private: true,
                presence: { key: currentUserId },
              },
            })
            .on("presence", { event: "sync" }, () => {
              if (!workspaceChannel) return;
              syncPresence(
                workspaceChannel.presenceState<WorkspacePresencePayload>(),
              );
            })
            .on<DeleteBroadcastPayload>(
              "broadcast",
              { event: "DELETE" },
              handleDelete,
            )
            .on<CommentTypingPayload>(
              "broadcast",
              { event: "typing" },
              ({ payload }) => handleTypingEventRef.current(payload),
            )
            .subscribe((nextStatus) => {
              handleChannelStatus("workspace", nextStatus);
              if (nextStatus === "SUBSCRIBED" && workspaceChannel) {
                void workspaceChannel.track(createPresencePayload());
              }
            });
          workspaceChannelRef.current = workspaceChannel;
        } catch {
          if (active) setStatus("disconnected");
        }
      })();
    }

    return () => {
      active = false;
      workspaceChannelSubscribedRef.current = false;
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (postgresChannel) void supabase.removeChannel(postgresChannel);
      if (workspaceChannel) {
        void workspaceChannel.untrack();
        if (workspaceChannelRef.current === workspaceChannel) {
          workspaceChannelRef.current = null;
        }
        void supabase.removeChannel(workspaceChannel);
      }
      clearPresence();
      clearTyping();
    };
  }, [
    clearPresence,
    clearTyping,
    connectionEpoch,
    createPresencePayload,
    currentUserId,
    syncPresence,
    workspaceId,
  ]);

  return {
    status,
    latestChange: changeState.latestChange,
    resyncVersion: changeState.revision + reconnectVersion,
    onlineMembers,
    typingUserIds,
    notifyTyping,
    accessRevoked: revokedWorkspaceId === workspaceId,
  };
}
