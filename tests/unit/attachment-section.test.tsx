import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttachmentSection } from "@/features/storage/attachments/attachment-section";
import type { AttachmentItem } from "@/features/storage/attachments/types";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createMetadata: vi.fn(),
  deleteAttachment: vi.fn(),
  getDownload: vi.fn(),
  compensate: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));
vi.mock("@/features/storage/attachments/actions", () => ({
  createAttachmentMetadata: mocks.createMetadata,
  deleteAttachment: mocks.deleteAttachment,
  getAttachmentDownload: mocks.getDownload,
}));
vi.mock("@/features/storage/attachments/compensation", () => ({
  compensateAttachmentUpload: mocks.compensate,
}));

function attachment(overrides: Partial<AttachmentItem> = {}): AttachmentItem {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    taskId,
    workspaceId,
    uploader: { id: userId, displayName: "Alice", avatarUrl: null },
    fileName: "notes.txt",
    contentType: "text/plain",
    sizeBytes: 12,
    createdAt: "2026-07-11T00:00:00Z",
    canDelete: true,
    ...overrides,
  };
}

describe("AttachmentSection", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.createMetadata.mockReset();
    mocks.deleteAttachment.mockReset();
    mocks.getDownload.mockReset();
    mocks.compensate.mockReset();
  });

  it("shows metadata and only renders authorized delete actions", () => {
    render(
      <AttachmentSection
        workspaceId={workspaceId}
        taskId={taskId}
        attachments={[attachment(), attachment({ id: "other", fileName: "locked.pdf", canDelete: false })]}
        onCountChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "附件" })).toBeVisible();
    expect(screen.getByText("notes.txt")).toBeVisible();
    expect(screen.getByText("locked.pdf")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /删除附件/ })).toHaveLength(1);
  });

  it("uploads one object before saving metadata", async () => {
    const upload = vi.fn().mockResolvedValue({ data: {}, error: null });
    mocks.createClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ upload })) },
    });
    mocks.createMetadata.mockResolvedValue({ ok: true, data: attachment() });
    const onCountChange = vi.fn();
    render(
      <AttachmentSection
        workspaceId={workspaceId}
        taskId={taskId}
        attachments={[]}
        onCountChange={onCountChange}
      />,
    );

    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("附件文件"), {
      target: { files: [file] },
    });

    await screen.findByText("notes.txt");
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${workspaceId}/${taskId}/.+-notes\\.txt$`)),
      file,
      { contentType: "text/plain", upsert: false },
    );
    expect(mocks.createMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId, taskId, fileName: "notes.txt" }),
    );
    expect(onCountChange).toHaveBeenCalledWith(1);
  });

  it("compensates when metadata persistence fails", async () => {
    const upload = vi.fn().mockResolvedValue({ data: {}, error: null });
    mocks.createClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ upload })) },
    });
    mocks.createMetadata.mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "暂时无法保存附件信息，请稍后重试" },
    });
    mocks.compensate.mockResolvedValue({ ok: true });
    render(
      <AttachmentSection
        workspaceId={workspaceId}
        taskId={taskId}
        attachments={[]}
        onCountChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("附件文件"), {
      target: { files: [new File(["hello"], "notes.txt", { type: "text/plain" })] },
    });

    await waitFor(() => expect(mocks.compensate).toHaveBeenCalledOnce());
    expect(screen.getByText("暂时无法保存附件信息，请稍后重试")).toBeVisible();
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  });
});
