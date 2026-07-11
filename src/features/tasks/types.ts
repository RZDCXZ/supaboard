import type { WorkspaceMember } from "@/features/members/types";

export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskPriority = "low" | "medium" | "high";

export type TaskMemberOption = Pick<
  WorkspaceMember,
  "id" | "displayName" | "avatarUrl"
>;

export type TaskAssignee = TaskMemberOption;

export type TaskItem = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: TaskAssignee | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  attachmentCount: number;
};

export type WorkspaceTaskStats = {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
};

export type TaskFilters = {
  status: TaskStatus | "all";
  assignee: "all" | "unassigned" | string;
  page: number;
  taskId: string | null;
};

export type TaskPage = {
  tasks: TaskItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type TaskActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: TaskActionErrorCode;
        message: string;
        fields?: Record<string, string>;
      };
    };

export type CreateTaskInput = {
  workspaceId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
};

export type TaskPatch =
  | { field: "title"; value: string }
  | { field: "description"; value: string | null }
  | { field: "status"; value: TaskStatus }
  | { field: "priority"; value: TaskPriority }
  | { field: "assigneeId"; value: string | null };

export type UpdateTaskInput = {
  workspaceId: string;
  taskId: string;
  patch: TaskPatch;
};

export type DeleteTaskInput = {
  workspaceId: string;
  taskId: string;
};
