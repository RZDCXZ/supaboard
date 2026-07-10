import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { TaskStatus } from "@/features/tasks/types";
import type { Database, Json } from "@/types/database";

import type { ActivityAction, ActivityItem, ActivityPage } from "./types";

export const ACTIVITY_PAGE_SIZE = 20;

export const ACTIVITY_SELECT =
  "id, workspace_id, actor_id, action, entity_type, entity_id, metadata, created_at, actor:profiles!activity_logs_actor_id_fkey(id, display_name, avatar_path)" as const;

export type ActivityRow = {
  id: number;
  workspace_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Json;
  created_at: string;
  actor: {
    id: string;
    display_name: string;
    avatar_path: string | null;
  } | null;
};

export class ActivityQueryError extends Error {
  constructor(message = "ACTIVITY_QUERY_FAILED") {
    super(message);
    this.name = "ActivityQueryError";
  }
}

function toActivityAction(value: string): ActivityAction {
  if (
    value === "task.created" ||
    value === "task.status_changed" ||
    value === "task.deleted"
  ) {
    return value;
  }

  throw new ActivityQueryError("INVALID_ACTIVITY_ACTION");
}

function toTaskStatus(value: unknown): TaskStatus | null {
  return value === "todo" || value === "in_progress" || value === "done"
    ? value
    : null;
}

function metadataObject(metadata: Json) {
  return metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
    ? metadata
    : null;
}

export function mapActivityRow(row: ActivityRow): ActivityItem {
  const metadata = metadataObject(row.metadata);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actor: row.actor
      ? {
          id: row.actor.id,
          displayName: row.actor.display_name,
          avatarPath: row.actor.avatar_path,
        }
      : null,
    action: toActivityAction(row.action),
    entityId: row.entity_id,
    title: typeof metadata?.title === "string" ? metadata.title : null,
    fromStatus: toTaskStatus(metadata?.from_status),
    toStatus: toTaskStatus(metadata?.to_status),
    status: toTaskStatus(metadata?.status),
    createdAt: row.created_at,
  };
}

export async function getWorkspaceActivityPage(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  requestedBatch: number,
): Promise<ActivityPage> {
  const batch =
    Number.isSafeInteger(requestedBatch) && requestedBatch >= 1
      ? requestedBatch
      : 1;
  const limit = batch * ACTIVITY_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("activity_logs")
    .select(ACTIVITY_SELECT, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, limit - 1);

  if (error) {
    throw new ActivityQueryError();
  }

  const total = count ?? 0;
  return {
    activities: ((data ?? []) as ActivityRow[]).map(mapActivityRow),
    batch,
    pageSize: ACTIVITY_PAGE_SIZE,
    total,
    hasMore: limit < total,
  };
}
