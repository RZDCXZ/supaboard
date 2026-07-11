import { z } from "zod";

export const ATTACHMENT_BUCKET = "attachments";
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const uuidSchema = z.string().uuid("标识格式不正确");
const safeFileNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/, "附件路径格式不正确");

const extensionByContentType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
} as const;

export type AttachmentContentType = keyof typeof extensionByContentType;

type AttachmentFileInput = {
  name: string;
  type: string;
  size: number;
};

export type ValidatedAttachmentFile = {
  fileName: string;
  contentType: AttachmentContentType;
  sizeBytes: number;
  safeFileName: string;
};

function buildSafeFileName(fileName: string, contentType: AttachmentContentType) {
  const extension = extensionByContentType[contentType];
  const lastDot = fileName.lastIndexOf(".");
  const basename = (lastDot > 0 ? fileName.slice(0, lastDot) : fileName)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const maxBasenameLength = 119 - extension.length;
  const safeBasename = basename.slice(0, maxBasenameLength).replace(/-+$/g, "");

  return `${safeBasename || "attachment"}.${extension}`;
}

export function validateAttachmentFile(
  file: AttachmentFileInput,
):
  | { ok: true; data: ValidatedAttachmentFile }
  | { ok: false; message: string } {
  const fileName = file.name.trim();

  if (
    fileName.length < 1 ||
    fileName.length > 255 ||
    /[\\/\u0000-\u001f\u007f]/.test(fileName)
  ) {
    return { ok: false, message: "附件名称不合法" };
  }

  if (file.size < 1) return { ok: false, message: "附件不能为空" };
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, message: "附件不能超过 10 MB" };
  }

  if (!(file.type in extensionByContentType)) {
    return { ok: false, message: "不支持此附件类型" };
  }

  const contentType = file.type as AttachmentContentType;

  return {
    ok: true,
    data: {
      fileName,
      contentType,
      sizeBytes: file.size,
      safeFileName: buildSafeFileName(fileName, contentType),
    },
  };
}

export const attachmentObjectPathInputSchema = z.object({
  workspaceId: uuidSchema,
  taskId: uuidSchema,
  safeFileName: safeFileNameSchema,
  objectId: uuidSchema,
});

const attachmentFileNameSchema = z
  .string()
  .trim()
  .min(1, "附件名称不合法")
  .max(255, "附件名称不合法")
  .refine((value) => !/[\\/\u0000-\u001f\u007f]/.test(value), "附件名称不合法");

const attachmentContentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

export const createAttachmentMetadataInputSchema = z.object({
  workspaceId: uuidSchema,
  taskId: uuidSchema,
  objectId: uuidSchema,
  safeFileName: safeFileNameSchema,
  fileName: attachmentFileNameSchema,
  contentType: attachmentContentTypeSchema,
  sizeBytes: z.number().int().min(1, "附件不能为空").max(ATTACHMENT_MAX_BYTES),
});

export const attachmentActionInputSchema = z.object({
  workspaceId: uuidSchema,
  taskId: uuidSchema,
  attachmentId: uuidSchema,
});

export function getAttachmentFieldErrors(error: z.ZodError) {
  return error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path.at(-1);
    if (typeof field === "string" && !errors[field]) errors[field] = issue.message;
    return errors;
  }, {});
}

export function buildAttachmentObjectPath(
  input: z.input<typeof attachmentObjectPathInputSchema>,
) {
  const parsed = attachmentObjectPathInputSchema.parse(input);
  return `${parsed.workspaceId}/${parsed.taskId}/${parsed.objectId}-${parsed.safeFileName}`;
}
