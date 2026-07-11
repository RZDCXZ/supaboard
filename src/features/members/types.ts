export type WorkspaceMemberRole = "owner" | "member";

export type WorkspaceMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: WorkspaceMemberRole;
  joinedAt: string;
};
