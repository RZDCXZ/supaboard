export type CommentAuthor = {
  id: string;
  displayName: string;
  avatarPath: string | null;
};

export type CommentItem = {
  id: string;
  taskId: string;
  workspaceId: string;
  author: CommentAuthor;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type CommentActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type CommentActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: CommentActionErrorCode;
        message: string;
        fields?: Record<string, string>;
      };
    };
