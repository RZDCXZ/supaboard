import { describe, expect, it, vi } from "vitest";

import {
  AVATAR_MAX_FILE_SIZE,
  buildAvatarPath,
  getAvatarPublicUrl,
  validateAvatarFile,
} from "@/features/storage/avatar";

function imageFile(name: string, type: string, size = 16) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("validateAvatarFile", () => {
  it.each([
    ["avatar.JPG", "image/jpeg", "jpg"],
    ["avatar.jpeg", "image/jpeg", "jpg"],
    ["avatar.PNG", "image/png", "png"],
    ["avatar.webp", "image/webp", "webp"],
  ])("accepts %s and returns its canonical extension", (name, type, extension) => {
    expect(validateAvatarFile(imageFile(name, type))).toEqual({
      success: true,
      extension,
    });
  });

  it("rejects unsupported MIME types", () => {
    expect(validateAvatarFile(imageFile("avatar.gif", "image/gif"))).toEqual({
      success: false,
      code: "INVALID_TYPE",
      message: "请选择 JPEG、PNG 或 WebP 图片",
    });
  });

  it("rejects a filename extension that does not match the MIME type", () => {
    expect(validateAvatarFile(imageFile("avatar.png", "image/jpeg"))).toEqual({
      success: false,
      code: "INVALID_EXTENSION",
      message: "文件扩展名与图片类型不匹配",
    });
  });

  it("rejects files larger than 2 MB", () => {
    expect(
      validateAvatarFile(
        imageFile("avatar.png", "image/png", AVATAR_MAX_FILE_SIZE + 1),
      ),
    ).toEqual({
      success: false,
      code: "FILE_TOO_LARGE",
      message: "头像不能超过 2 MB",
    });
  });
});

describe("avatar paths", () => {
  it("builds a fixed path with the authenticated user id", () => {
    expect(
      buildAvatarPath("00000000-0000-4000-8000-000000000011", "webp"),
    ).toBe("00000000-0000-4000-8000-000000000011/avatar.webp");
  });

  it("rejects invalid user ids", () => {
    expect(() => buildAvatarPath("not-a-uuid", "png")).toThrow(
      "无法生成头像路径",
    );
  });
});

describe("getAvatarPublicUrl", () => {
  it("returns null when no avatar path exists", () => {
    const from = vi.fn();

    expect(getAvatarPublicUrl({ storage: { from } } as never, null)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("resolves a public avatars URL", () => {
    const getPublicUrl = vi.fn(() => ({
      data: { publicUrl: "http://127.0.0.1/avatar.png" },
    }));
    const from = vi.fn(() => ({ getPublicUrl }));
    const client = { storage: { from } } as never;

    expect(getAvatarPublicUrl(client, "user/avatar.png")).toBe(
      "http://127.0.0.1/avatar.png",
    );
    expect(from).toHaveBeenCalledWith("avatars");
    expect(getPublicUrl).toHaveBeenCalledWith("user/avatar.png");
  });
});
