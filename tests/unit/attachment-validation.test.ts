import { describe, expect, it } from "vitest";

import {
  buildAttachmentObjectPath,
  validateAttachmentFile,
} from "@/features/storage/attachments/validation";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";
const objectId = "33333333-3333-4333-8333-333333333333";

describe("attachment validation", () => {
  it("normalizes a display name and creates a bounded safe object name", () => {
    expect(
      validateAttachmentFile({
        name: "  Résumé final (1).PDF  ",
        type: "application/pdf",
        size: 42,
      }),
    ).toEqual({
      ok: true,
      data: {
        fileName: "Résumé final (1).PDF",
        contentType: "application/pdf",
        sizeBytes: 42,
        safeFileName: "resume-final-1.pdf",
      },
    });
  });

  it("falls back to a canonical filename when the basename has no ASCII characters", () => {
    expect(
      validateAttachmentFile({
        name: "说明.txt",
        type: "text/plain",
        size: 5,
      }),
    ).toMatchObject({
      ok: true,
      data: { fileName: "说明.txt", safeFileName: "attachment.txt" },
    });
  });

  it.each([
    [{ name: "empty.txt", type: "text/plain", size: 0 }, "附件不能为空"],
    [
      { name: "large.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 },
      "附件不能超过 10 MB",
    ],
    [{ name: "script.js", type: "text/javascript", size: 10 }, "不支持此附件类型"],
    [{ name: "../secret.txt", type: "text/plain", size: 10 }, "附件名称不合法"],
  ])("rejects an invalid file", (file, message) => {
    expect(validateAttachmentFile(file)).toEqual({ ok: false, message });
  });

  it("builds the documented workspace/task/uuid object path", () => {
    expect(
      buildAttachmentObjectPath({
        workspaceId,
        taskId,
        safeFileName: "report.pdf",
        objectId,
      }),
    ).toBe(`${workspaceId}/${taskId}/${objectId}-report.pdf`);
  });
});
