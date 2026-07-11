import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileSettingsForm } from "@/features/profiles/profile-settings-form";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getPublicUrl: vi.fn(),
  refresh: vi.fn(),
  remove: vi.fn(),
  updateAvatarPath: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    storage: { from: mocks.from },
  })),
}));

vi.mock("@/features/profiles/actions", () => ({
  updateAvatarPath: mocks.updateAvatarPath,
  updateDisplayName: vi.fn(async () => ({ status: "idle", message: "" })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

const userId = "00000000-0000-4000-8000-000000000011";

function renderForm(
  overrides: Partial<React.ComponentProps<typeof ProfileSettingsForm>> = {},
) {
  return render(
    <ProfileSettingsForm
      userId={userId}
      displayName="Alice"
      avatarPath={null}
      avatarUrl={null}
      {...overrides}
    />,
  );
}

describe("ProfileSettingsForm", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.getPublicUrl.mockReset();
    mocks.refresh.mockReset();
    mocks.remove.mockReset();
    mocks.updateAvatarPath.mockReset();
    mocks.upload.mockReset();
    mocks.from.mockReturnValue({
      getPublicUrl: mocks.getPublicUrl,
      remove: mocks.remove,
      upload: mocks.upload,
    });
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: "http://127.0.0.1/new-avatar.jpg" },
    });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:avatar-preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("shows a neutral initial when no avatar exists", () => {
    renderForm();

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByLabelText("头像文件")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
  });

  it("rejects invalid files before uploading", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("头像文件"), {
      target: {
        files: [new File(["gif"], "avatar.gif", { type: "image/gif" })],
      },
    });

    expect(
      await screen.findByText("请选择 JPEG、PNG 或 WebP 图片"),
    ).toBeInTheDocument();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uploads, saves the profile, and removes an old extension", async () => {
    mocks.upload.mockResolvedValue({ data: { path: `${userId}/avatar.jpg` }, error: null });
    mocks.updateAvatarPath.mockResolvedValue({
      status: "success",
      message: "头像已更新",
    });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    renderForm({
      avatarPath: `${userId}/avatar.png`,
      avatarUrl: "http://127.0.0.1/old-avatar.png",
    });

    const file = new File(["jpeg"], "portrait.jpeg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("头像文件"), {
      target: { files: [file] },
    });

    expect(await screen.findByText("头像已更新")).toBeInTheDocument();
    expect(mocks.upload).toHaveBeenCalledWith(`${userId}/avatar.jpg`, file, {
      cacheControl: "0",
      contentType: "image/jpeg",
      upsert: true,
    });
    expect(mocks.updateAvatarPath).toHaveBeenCalledWith(`${userId}/avatar.jpg`);
    expect(mocks.remove).toHaveBeenCalledWith([`${userId}/avatar.png`]);
    expect(mocks.refresh).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:avatar-preview");
  });

  it("retries the profile update without uploading the file twice", async () => {
    mocks.upload.mockResolvedValue({ data: { path: `${userId}/avatar.webp` }, error: null });
    mocks.updateAvatarPath
      .mockResolvedValueOnce({
        status: "error",
        code: "INTERNAL_ERROR",
        message: "暂时无法保存个人资料，请稍后重试",
      })
      .mockResolvedValueOnce({ status: "success", message: "头像已更新" });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    renderForm();

    fireEvent.change(screen.getByLabelText("头像文件"), {
      target: {
        files: [new File(["webp"], "avatar.webp", { type: "image/webp" })],
      },
    });

    const retry = await screen.findByRole("button", { name: "重试保存头像" });
    fireEvent.click(retry);

    await waitFor(() => expect(mocks.updateAvatarPath).toHaveBeenCalledTimes(2));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("头像已更新")).toBeInTheDocument();
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("blob:avatar-preview");
  });

  it("keeps the new avatar when old-object cleanup fails", async () => {
    mocks.upload.mockResolvedValue({ data: { path: `${userId}/avatar.jpg` }, error: null });
    mocks.updateAvatarPath.mockResolvedValue({ status: "success", message: "头像已更新" });
    mocks.remove.mockResolvedValue({ data: null, error: { message: "remove failed" } });
    renderForm({ avatarPath: `${userId}/avatar.png` });

    fireEvent.change(screen.getByLabelText("头像文件"), {
      target: {
        files: [new File(["jpeg"], "avatar.jpg", { type: "image/jpeg" })],
      },
    });

    expect(
      await screen.findByText("头像已更新，但旧文件清理失败，可稍后再次更换"),
    ).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
