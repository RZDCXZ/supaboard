export type AttachmentUploader = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type AttachmentItem = {
  id: string;
  taskId: string;
  workspaceId: string;
  uploader: AttachmentUploader;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  canDelete: boolean;
};

export type AttachmentActionErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type AttachmentActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: AttachmentActionErrorCode;
        message: string;
        fields?: Record<string, string>;
      };
    };

