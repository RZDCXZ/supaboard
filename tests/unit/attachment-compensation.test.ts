import { describe, expect, it, vi } from "vitest";

import { compensateAttachmentUpload } from "@/features/storage/attachments/compensation";

describe("attachment upload compensation", () => {
  it("removes the uploaded object after metadata failure", async () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = { storage: { from: vi.fn(() => ({ remove })) } };

    await expect(
      compensateAttachmentUpload(client as never, "workspace/task/object.txt"),
    ).resolves.toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith(["workspace/task/object.txt"]);
  });

  it("reports a cleanup failure without exposing the path", async () => {
    const client = {
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn().mockResolvedValue({ data: null, error: { message: "secret path" } }),
        })),
      },
    };

    await expect(
      compensateAttachmentUpload(client as never, "workspace/task/object.txt"),
    ).resolves.toEqual({
      ok: false,
      message: "附件信息保存失败，临时文件也未能清理，请稍后重试",
    });
  });
});
