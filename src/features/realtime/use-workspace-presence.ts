"use client";

import type { RealtimePresenceState } from "@supabase/supabase-js";
import { useCallback, useState } from "react";

export type WorkspacePresencePayload = {
  userId: string;
  displayName: string;
  onlineAt: string;
};

export type OnlineWorkspaceMember = WorkspacePresencePayload;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePresence(
  state: RealtimePresenceState<WorkspacePresencePayload>,
) {
  const members = new Map<string, OnlineWorkspaceMember>();

  for (const presence of Object.values(state).flat()) {
    if (
      !UUID_PATTERN.test(presence.userId) ||
      typeof presence.displayName !== "string" ||
      presence.displayName.trim().length === 0 ||
      typeof presence.onlineAt !== "string" ||
      Number.isNaN(Date.parse(presence.onlineAt))
    ) {
      continue;
    }

    const current = members.get(presence.userId);
    if (!current || Date.parse(presence.onlineAt) > Date.parse(current.onlineAt)) {
      members.set(presence.userId, {
        userId: presence.userId,
        displayName: presence.displayName,
        onlineAt: presence.onlineAt,
      });
    }
  }

  return [...members.values()].toSorted((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );
}

export function useWorkspacePresence({
  currentUserId,
  currentUserDisplayName,
}: {
  currentUserId: string;
  currentUserDisplayName: string;
}) {
  const [onlineMembers, setOnlineMembers] = useState<OnlineWorkspaceMember[]>([]);

  const createPresencePayload = useCallback(
    (): WorkspacePresencePayload => ({
      userId: currentUserId,
      displayName: currentUserDisplayName,
      onlineAt: new Date().toISOString(),
    }),
    [currentUserDisplayName, currentUserId],
  );

  const syncPresence = useCallback(
    (state: RealtimePresenceState<WorkspacePresencePayload>) => {
      setOnlineMembers(normalizePresence(state));
    },
    [],
  );

  const clearPresence = useCallback(() => setOnlineMembers([]), []);

  return {
    onlineMembers,
    createPresencePayload,
    syncPresence,
    clearPresence,
  };
}
