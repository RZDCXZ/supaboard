export type WorkspaceRole = "owner" | "member";

export type WorkspaceListItem = {
  id: string;
  name: string;
  role: WorkspaceRole;
  updatedAt: string;
  href: string;
};

export type WorkspaceDetail = {
  id: string;
  name: string;
  currentUserId: string;
  role: WorkspaceRole;
  updatedAt: string;
};

export type WorkspaceActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type WorkspaceFieldErrors = Partial<Record<"name", string>>;

export type WorkspaceActionState = {
  status: "idle" | "error";
  code?: WorkspaceActionErrorCode;
  message?: string;
  fieldErrors?: WorkspaceFieldErrors;
};

export const initialWorkspaceActionState: WorkspaceActionState = {
  status: "idle",
};
