import type { TaskStatus } from "@/features/tasks/types";

export type ActivityAction =
  | "task.created"
  | "task.status_changed"
  | "task.deleted";

export type ActivityActor = {
  id: string;
  displayName: string;
  avatarPath: string | null;
};

export type ActivityItem = {
  id: number;
  workspaceId: string;
  actor: ActivityActor | null;
  action: ActivityAction;
  entityId: string;
  title: string | null;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  status: TaskStatus | null;
  createdAt: string;
};

export type ActivityPage = {
  activities: ActivityItem[];
  batch: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type WorkspaceTab = "tasks" | "members" | "activity";

export type WorkspaceView = {
  tab: WorkspaceTab;
  activityPage: number;
};
