"use client";

import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js";
import { useEffect, useReducer, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

import {
  initialWorkspaceChangeState,
  type WorkspaceChangeTable,
  workspaceChangeReducer,
} from "./reducer";

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

type ChannelKind = "postgres" | "broadcast";

export function useWorkspaceChanges(workspaceId: string) {
  const [changeState, dispatch] = useReducer(
    workspaceChangeReducer,
    initialWorkspaceChangeState,
  );
  const [status, setStatus] =
    useState<WorkspaceRealtimeStatus>("connecting");
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let postgresChannel: RealtimeChannel | null = null;
    let broadcastChannel: RealtimeChannel | null = null;
    const subscribed: Record<ChannelKind, boolean> = {
      postgres: false,
      broadcast: false,
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
      subscribed.broadcast = false;
      setStatus("disconnected");
    }

    function handleOnline() {
      setStatus("reconnecting");
      setConnectionEpoch((current) => current + 1);
    }

    function handleChannelStatus(kind: ChannelKind, nextStatus: string) {
      if (!active) return;

      if (nextStatus === "SUBSCRIBED") {
        if (subscribed[kind]) return;
        subscribed[kind] = true;

        if (subscribed.postgres && subscribed.broadcast) {
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
            .channel(`workspace-postgres:${workspaceId}`)
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

          broadcastChannel = supabase
            .channel(`workspace:${workspaceId}`, {
              config: { private: true },
            })
            .on<DeleteBroadcastPayload>(
              "broadcast",
              { event: "DELETE" },
              handleDelete,
            )
            .subscribe((nextStatus) =>
              handleChannelStatus("broadcast", nextStatus),
            );
        } catch {
          if (active) setStatus("disconnected");
        }
      })();
    }

    return () => {
      active = false;
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (postgresChannel) void supabase.removeChannel(postgresChannel);
      if (broadcastChannel) void supabase.removeChannel(broadcastChannel);
    };
  }, [connectionEpoch, workspaceId]);

  return {
    status,
    latestChange: changeState.latestChange,
    resyncVersion: changeState.revision + reconnectVersion,
  };
}
