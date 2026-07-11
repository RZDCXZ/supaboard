import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAttachmentMetadata,
  deleteAttachment,
  getAttachmentDownload,
} from "@/features/storage/attachments/actions";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const attachmentId = "44444444-4444-4444-8444-444444444444";
const objectId = "55555555-5555-4555-8555-555555555555";
const objectPath = `${workspaceId}/${taskId}/${objectId}-notes.txt`;

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

function attachmentRow() {
  return {
    id: attachmentId,
    task_id: taskId,
    workspace_id: workspaceId,
    uploader_id: userId,
    file_name: "notes.txt",
    content_type: "text/plain",
    size_bytes: 12,
    created_at: "2026-07-11T00:00:00Z",
    uploader: {
      id: userId,
      display_name: "Alice",
      avatar_path: null,
    },
  };
}

function authenticatedClient(from: ReturnType<typeof vi.fn>, storage: unknown) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      }),
    },
    from,
    storage,
  };
}

describe("attachment actions", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("reconstructs the object path while saving metadata", async () => {
    const builder = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    builder.insert.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.single.mockResolvedValue({ data: attachmentRow(), error: null });
    const from = vi.fn(() => builder);
    mocks.createClient.mockResolvedValue(
      authenticatedClient(from, {
        from: vi.fn(() => ({ getPublicUrl: vi.fn() })),
      }),
    );

    const result = await createAttachmentMetadata({
      workspaceId,
      taskId,
      objectId,
      safeFileName: "notes.txt",
      fileName: "notes.txt",
      contentType: "text/plain",
      sizeBytes: 12,
    });

    expect(builder.insert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      task_id: taskId,
      uploader_id: userId,
      bucket_id: "attachments",
      object_path: objectPath,
      file_name: "notes.txt",
      content_type: "text/plain",
      size_bytes: 12,
    });
    expect(result).toMatchObject({ ok: true, data: { id: attachmentId } });
  });

  it("creates a 60 second signed download without accepting a path", async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({
      data: { object_path: objectPath, file_name: "notes.txt" },
      error: null,
    });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://download.test/signed" },
      error: null,
    });
    mocks.createClient.mockResolvedValue(
      authenticatedClient(vi.fn(() => builder), {
        from: vi.fn(() => ({ createSignedUrl })),
      }),
    );

    await expect(
      getAttachmentDownload({ workspaceId, taskId, attachmentId }),
    ).resolves.toEqual({ ok: true, data: { url: "https://download.test/signed" } });
    expect(createSignedUrl).toHaveBeenCalledWith(objectPath, 60, {
      download: "notes.txt",
    });
  });

  it("deletes the object before deleting metadata", async () => {
    const events: string[] = [];
    const lookup = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    lookup.select.mockReturnValue(lookup);
    lookup.eq.mockReturnValue(lookup);
    lookup.maybeSingle.mockResolvedValue({ data: { object_path: objectPath }, error: null });
    const removal = vi.fn(async () => {
      events.push("object");
      return { data: [], error: null };
    });
    const metadataDelete = {
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(async () => {
        events.push("metadata");
        return { data: { id: attachmentId }, error: null };
      }),
    };
    metadataDelete.delete.mockReturnValue(metadataDelete);
    metadataDelete.eq.mockReturnValue(metadataDelete);
    metadataDelete.select.mockReturnValue(metadataDelete);
    const from = vi
      .fn()
      .mockReturnValueOnce(lookup)
      .mockReturnValueOnce(metadataDelete);
    mocks.createClient.mockResolvedValue(
      authenticatedClient(from, { from: vi.fn(() => ({ remove: removal })) }),
    );

    await expect(
      deleteAttachment({ workspaceId, taskId, attachmentId }),
    ).resolves.toEqual({ ok: true, data: attachmentId });
    expect(removal).toHaveBeenCalledWith([objectPath]);
    expect(events).toEqual(["object", "metadata"]);
  });

  it("keeps metadata when object deletion fails", async () => {
    const lookup = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    lookup.select.mockReturnValue(lookup);
    lookup.eq.mockReturnValue(lookup);
    lookup.maybeSingle.mockResolvedValue({ data: { object_path: objectPath }, error: null });
    const from = vi.fn(() => lookup);
    mocks.createClient.mockResolvedValue(
      authenticatedClient(from, {
        from: vi.fn(() => ({
          remove: vi.fn().mockResolvedValue({ data: null, error: { message: "private" } }),
        })),
      }),
    );

    const result = await deleteAttachment({ workspaceId, taskId, attachmentId });

    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
    expect(from).toHaveBeenCalledTimes(1);
  });
});

