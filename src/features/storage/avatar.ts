import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_FILE_SIZE = 2 * 1024 * 1024;

export type AvatarExtension = "jpg" | "png" | "webp";

export type AvatarValidationResult =
  | { success: true; extension: AvatarExtension }
  | {
      success: false;
      code: "INVALID_TYPE" | "INVALID_EXTENSION" | "FILE_TOO_LARGE";
      message: string;
    };

const mimeExtensions = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
} as const;

const canonicalExtensions: Record<keyof typeof mimeExtensions, AvatarExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateAvatarFile(file: File): AvatarValidationResult {
  if (!(file.type in mimeExtensions)) {
    return {
      success: false,
      code: "INVALID_TYPE",
      message: "请选择 JPEG、PNG 或 WebP 图片",
    };
  }

  const mime = file.type as keyof typeof mimeExtensions;
  const extension = file.name.split(".").at(-1)?.toLocaleLowerCase();

  if (!extension || !(mimeExtensions[mime] as readonly string[]).includes(extension)) {
    return {
      success: false,
      code: "INVALID_EXTENSION",
      message: "文件扩展名与图片类型不匹配",
    };
  }

  if (file.size > AVATAR_MAX_FILE_SIZE) {
    return {
      success: false,
      code: "FILE_TOO_LARGE",
      message: "头像不能超过 2 MB",
    };
  }

  return { success: true, extension: canonicalExtensions[mime] };
}

export function buildAvatarPath(userId: string, extension: AvatarExtension) {
  if (!uuidPattern.test(userId)) {
    throw new Error("无法生成头像路径");
  }

  return `${userId}/avatar.${extension}`;
}

export function getAvatarPublicUrl(
  client: SupabaseClient<Database>,
  avatarPath: string | null,
) {
  if (!avatarPath) return null;

  return client.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath).data.publicUrl;
}
