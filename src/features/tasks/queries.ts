import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { getAvatarPublicUrl } from "@/features/storage/avatar";

import { clampTaskPageSize } from "./search-params";
import type {
  TaskFilters,
  TaskItem,
  TaskPage,
  TaskPriority,
  TaskStatus,
  WorkspaceTaskStats,
} from "./types";

export const TASK_SELECT =
  "id, workspace_id, title, description, status, priority, assignee_id, created_by, created_at, updated_at, assignee:profiles!tasks_assignee_id_fkey(id, display_name, avatar_path), attachments(count)" as const;

export type TaskRow = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  attachments: { count: number }[];
  assignee: {
    id: string;
    display_name: string;
    avatar_path: string | null;
  } | null;
};

export class TaskQueryError extends Error {
  constructor(message = "TASK_QUERY_FAILED") {
    super(message);
    this.name = "TaskQueryError";
  }
}

function toTaskStatus(value: string): TaskStatus {
  if (value === "todo" || value === "in_progress" || value === "done") {
    return value;
  }

  throw new TaskQueryError("INVALID_TASK_STATUS");
}

function toTaskPriority(value: string): TaskPriority {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  throw new TaskQueryError("INVALID_TASK_PRIORITY");
}

export function mapTaskRow(
  row: TaskRow,
  supabase: SupabaseClient<Database>,
): TaskItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    status: toTaskStatus(row.status),
    priority: toTaskPriority(row.priority),
    assignee: row.assignee
      ? {
          id: row.assignee.id,
          displayName: row.assignee.display_name,
          avatarUrl: getAvatarPublicUrl(supabase, row.assignee.avatar_path),
        }
      : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachmentCount: Number(row.attachments?.[0]?.count ?? 0),
  };
}

export async function getWorkspaceTaskPage(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  filters: TaskFilters,
  requestedPageSize?: number,
): Promise<TaskPage> {
  const pageSize = clampTaskPageSize(requestedPageSize);
  const offset = (filters.page - 1) * pageSize;
  let query = supabase
    .from("tasks")
    .select(TASK_SELECT, { count: "exact" })
    .eq("workspace_id", workspaceId);

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.assignee === "unassigned") {
    query = query.is("assignee_id", null);
  } else if (filters.assignee !== "all") {
    query = query.eq("assignee_id", filters.assignee);
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new TaskQueryError();
  }

  const total = count ?? 0;

  return {
    tasks: ((data ?? []) as TaskRow[]).map((row) => mapTaskRow(row, supabase)),
    page: filters.page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getWorkspaceTask(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  taskId: string,
): Promise<TaskItem | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    throw new TaskQueryError();
  }

  return data ? mapTaskRow(data as TaskRow, supabase) : null;
}

export async function getWorkspaceTaskStats(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
): Promise<WorkspaceTaskStats> {
  const { data, error } = await supabase.rpc("get_workspace_stats", {
    target_workspace_id: workspaceId,
  });

  if (error || !data?.[0]) {
    throw new TaskQueryError("TASK_STATS_QUERY_FAILED");
  }

  const stats = data[0];
  return {
    total: Number(stats.total),
    todo: Number(stats.todo),
    inProgress: Number(stats.in_progress),
    done: Number(stats.done),
  };
}
