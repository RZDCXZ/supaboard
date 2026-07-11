"use client";

import {
  DownloadIcon,
  FileIcon,
  PaperclipIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { InlineAlert } from "@/components/feedback/inline-alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatFullDateTime } from "@/lib/date-time";
import { createClient } from "@/lib/supabase/client";

import {
  createAttachmentMetadata,
  deleteAttachment,
  getAttachmentDownload,
} from "./actions";
import { compensateAttachmentUpload } from "./compensation";
import type { AttachmentItem } from "./types";
import {
  ATTACHMENT_BUCKET,
  buildAttachmentObjectPath,
  validateAttachmentFile,
} from "./validation";

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function AttachmentSection({
  workspaceId,
  taskId,
  attachments,
  onCountChange,
}: {
  workspaceId: string;
  taskId: string;
  attachments: readonly AttachmentItem[];
  onCountChange: (count: number) => void;
}) {
  const [items, setItems] = useState([...attachments]);
  const [uploading, setUploading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setError(null);
    const validated = validateAttachmentFile(file);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }

    setUploading(true);
    const objectId = crypto.randomUUID();
    const objectPath = buildAttachmentObjectPath({
      workspaceId,
      taskId,
      objectId,
      safeFileName: validated.data.safeFileName,
    });
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(objectPath, file, {
        contentType: validated.data.contentType,
        upsert: false,
      });

    if (uploadError) {
      setUploading(false);
      setError("暂时无法上传附件，请稍后重试");
      return;
    }

    const result = await createAttachmentMetadata({
      workspaceId,
      taskId,
      objectId,
      ...validated.data,
    });

    if (!result.ok) {
      const compensation = await compensateAttachmentUpload(supabase, objectPath);
      setUploading(false);
      setError(compensation.ok ? result.error.message : compensation.message);
      return;
    }

    const nextItems = [...items, result.data];
    setItems(nextItems);
    onCountChange(nextItems.length);
    setUploading(false);
    toast.success("附件已上传");
  }

  async function download(item: AttachmentItem) {
    setError(null);
    setPendingId(item.id);
    const result = await getAttachmentDownload({
      workspaceId,
      taskId,
      attachmentId: item.id,
    });
    setPendingId(null);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    window.location.assign(result.data.url);
  }

  async function remove(item: AttachmentItem) {
    setError(null);
    setPendingId(item.id);
    const result = await deleteAttachment({
      workspaceId,
      taskId,
      attachmentId: item.id,
    });
    setPendingId(null);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    const nextItems = items.filter(({ id }) => id !== item.id);
    setItems(nextItems);
    onCountChange(nextItems.length);
    toast.success("附件已删除");
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="task-attachments-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="task-attachments-heading" className="font-medium">
          附件
        </h2>
        <span className="text-xs text-muted-foreground">{items.length} 个</span>
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted/50">
        {uploading ? <Spinner aria-hidden="true" /> : <PaperclipIcon aria-hidden="true" />}
        {uploading ? "上传中…" : "选择附件"}
        <Input
          type="file"
          className="sr-only"
          aria-label="附件文件"
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
          disabled={uploading || pendingId !== null}
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (file) void uploadFile(file).finally(() => (input.value = ""));
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        支持 JPEG、PNG、WebP、PDF 和纯文本，单个文件不超过 10 MB。
      </p>

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      {items.length === 0 ? (
        <p className="rounded-lg bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
          当前任务还没有附件。
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-3">
              <FileIcon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.fileName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(item.sizeBytes)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Avatar size="sm">
                      {item.uploader.avatarUrl ? (
                        <AvatarImage
                          src={item.uploader.avatarUrl}
                          alt={`${item.uploader.displayName}的头像`}
                        />
                      ) : null}
                      <AvatarFallback>{initials(item.uploader.displayName)}</AvatarFallback>
                    </Avatar>
                    {item.uploader.displayName}
                  </span>
                  <time dateTime={item.createdAt}>{formatFullDateTime(item.createdAt)}</time>
                </div>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`下载附件 ${item.fileName}`}
                disabled={uploading || pendingId !== null}
                onClick={() => void download(item)}
              >
                {pendingId === item.id ? <Spinner /> : <DownloadIcon />}
              </Button>
              {item.canDelete ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="destructive"
                  aria-label={`删除附件 ${item.fileName}`}
                  disabled={uploading || pendingId !== null}
                  onClick={() => void remove(item)}
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
