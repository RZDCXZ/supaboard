import { z } from "zod";

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "请输入昵称")
  .max(80, "昵称不能超过 80 个字符");

export const updateDisplayNameSchema = z.object({
  displayName: displayNameSchema,
});

export function isOwnedAvatarPath(userId: string, avatarPath: string) {
  return new RegExp(
    `^${userId}/avatar\\.(?:jpg|jpeg|png|webp)$`,
  ).test(avatarPath);
}
