export type WorkspaceMemberRole = "owner" | "member";

export type WorkspaceMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: WorkspaceMemberRole;
  joinedAt: string;
};

export type MemberActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "USER_NOT_FOUND"
  | "MEMBER_ALREADY_EXISTS"
  | "INTERNAL_ERROR";

export type MemberActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: MemberActionErrorCode;
        message: string;
        fields?: { email?: string };
      };
    };

export type AddedWorkspaceMember = {
  userId: string;
  role: "member";
};
