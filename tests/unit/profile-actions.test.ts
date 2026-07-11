import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  updateAvatarPath,
  updateDisplayName,
} from "@/features/profiles/actions";
import { initialProfileActionState } from "@/features/profiles/types";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: vi.fn(() => ({ update: mocks.update })),
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

const userId = "00000000-0000-4000-8000-000000000011";

function displayNameForm(displayName: string) {
  const data = new FormData();
  data.set("displayName", displayName);
  return data;
}

describe("profile actions", () => {
  beforeEach(() => {
    mocks.eq.mockReset();
    mocks.getUser.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.update.mockReset();
    mocks.update.mockReturnValue({ eq: mocks.eq });
  });

  it("validates display names before accessing Supabase", async () => {
    const result = await updateDisplayName(
      initialProfileActionState,
      displayNameForm("   "),
    );

    expect(result).toEqual({
      status: "error",
      code: "VALIDATION_ERROR",
      message: "请检查输入后重试",
      fieldErrors: { displayName: "请输入昵称" },
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await updateDisplayName(
      initialProfileActionState,
      displayNameForm("Alice"),
    );

    expect(result).toEqual({
      status: "error",
      code: "NOT_AUTHENTICATED",
      message: "请先登录后再修改个人资料",
    });
  });

  it("trims and updates the current user's display name", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mocks.eq.mockResolvedValue({ error: null });

    const result = await updateDisplayName(
      initialProfileActionState,
      displayNameForm("  Alice Chen  "),
    );

    expect(mocks.update).toHaveBeenCalledWith({
      display_name: "Alice Chen",
      updated_at: expect.any(String),
    });
    expect(mocks.eq).toHaveBeenCalledWith("id", userId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout");
    expect(result).toEqual({
      status: "success",
      message: "昵称已保存",
    });
  });

  it("rejects avatar paths outside the authenticated user's directory", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    const result = await updateAvatarPath(
      "00000000-0000-4000-8000-000000000012/avatar.png",
    );

    expect(result).toEqual({
      status: "error",
      code: "VALIDATION_ERROR",
      message: "头像路径无效，请重新选择图片",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates a valid avatar path and revalidates the app layout", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mocks.eq.mockResolvedValue({ error: null });
    const avatarPath = `${userId}/avatar.webp`;

    const result = await updateAvatarPath(avatarPath);

    expect(mocks.update).toHaveBeenCalledWith({
      avatar_path: avatarPath,
      updated_at: expect.any(String),
    });
    expect(mocks.eq).toHaveBeenCalledWith("id", userId);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout");
    expect(result).toEqual({
      status: "success",
      message: "头像已更新",
    });
  });

  it("maps permission errors without exposing database details", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });
    mocks.eq.mockResolvedValue({ error: { code: "42501" } });

    const result = await updateAvatarPath(`${userId}/avatar.png`);

    expect(result).toEqual({
      status: "error",
      code: "FORBIDDEN",
      message: "你没有权限修改此个人资料",
    });
  });
});
