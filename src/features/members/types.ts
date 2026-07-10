export type WorkspaceMemberRole = "owner" | "member";

export type WorkspaceMember = {
  id: string;
  displayName: string;
  avatarPath: string | null;
  role: WorkspaceMemberRole;
  joinedAt: string;
};
