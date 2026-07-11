"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert } from "@/components/feedback/inline-alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  AVATAR_BUCKET,
  buildAvatarPath,
  validateAvatarFile,
} from "@/features/storage/avatar";
import { createClient } from "@/lib/supabase/client";

import { updateAvatarPath, updateDisplayName } from "./actions";
import { initialProfileActionState } from "./types";

type UploadFeedback = {
  variant: "success" | "warning" | "error";
  message: string;
} | null;

type PendingAvatar = {
  path: string;
  oldPath: string | null;
  previewUrl: string;
};

function initialFor(displayName: string) {
  return displayName.trim().charAt(0).toLocaleUpperCase() || "用";
}

export function ProfileSettingsForm({
  userId,
  displayName,
  avatarPath,
  avatarUrl,
}: {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [profileState, profileAction, profilePending] = useActionState(
    updateDisplayName,
    initialProfileActionState,
  );
  const [currentPath, setCurrentPath] = useState(avatarPath);
  const [currentUrl, setCurrentUrl] = useState(avatarUrl);
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<UploadFeedback>(null);
  const currentBlobUrlRef = useRef<string | null>(null);
  const pendingBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      const blobUrls = new Set(
        [currentBlobUrlRef.current, pendingBlobUrlRef.current].filter(
          (url): url is string => Boolean(url),
        ),
      );
      for (const url of blobUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  async function saveUploadedAvatar(candidate: PendingAvatar) {
    setUploading(true);
    const result = await updateAvatarPath(candidate.path);

    if (result.status === "error") {
      setPendingAvatar(candidate);
      setUploadFeedback({ variant: "error", message: result.message });
      setUploading(false);
      return;
    }

    if (
      currentBlobUrlRef.current &&
      currentBlobUrlRef.current !== candidate.previewUrl
    ) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
    }
    currentBlobUrlRef.current = candidate.previewUrl;
    pendingBlobUrlRef.current = null;
    setCurrentPath(candidate.path);
    setCurrentUrl(candidate.previewUrl);
    setPendingAvatar(null);

    const supabase = createClient();
    if (candidate.oldPath && candidate.oldPath !== candidate.path) {
      const { error: removeError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([candidate.oldPath]);

      if (removeError) {
        setUploadFeedback({
          variant: "warning",
          message: "头像已更新，但旧文件清理失败，可稍后再次更换",
        });
        setUploading(false);
        router.refresh();
        return;
      }
    }

    setUploadFeedback({ variant: "success", message: result.message });
    setUploading(false);
    router.refresh();
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadFeedback(null);
    const validation = validateAvatarFile(file);

    if (!validation.success) {
      setUploadFeedback({ variant: "error", message: validation.message });
      event.target.value = "";
      return;
    }

    setUploading(true);
    const path = buildAvatarPath(userId, validation.extension);
    if (pendingBlobUrlRef.current) {
      URL.revokeObjectURL(pendingBlobUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(file);
    pendingBlobUrlRef.current = previewUrl;
    const supabase = createClient();
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
      cacheControl: "0",
      contentType: file.type,
      upsert: true,
    });

    if (error) {
      URL.revokeObjectURL(previewUrl);
      pendingBlobUrlRef.current = null;
      setUploadFeedback({
        variant: "error",
        message: "头像上传失败，请检查文件后重试",
      });
      setUploading(false);
      event.target.value = "";
      return;
    }

    await saveUploadedAvatar({ path, oldPath: currentPath, previewUrl });
    event.target.value = "";
  }

  const uploadDisabled = uploading || profilePending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar className="size-18 text-xl">
          {currentUrl ? (
            <AvatarImage src={currentUrl} alt={`${displayName}的头像`} />
          ) : null}
          <AvatarFallback>{initialFor(displayName)}</AvatarFallback>
        </Avatar>

        <Field className="max-w-sm" data-invalid={uploadFeedback?.variant === "error"}>
          <FieldLabel htmlFor="avatar-file">头像文件</FieldLabel>
          <Input
            id="avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploadDisabled}
            onChange={handleAvatarChange}
            aria-describedby="avatar-file-description"
          />
          <FieldDescription id="avatar-file-description">
            JPEG、PNG 或 WebP，不超过 2 MB。
          </FieldDescription>
        </Field>
      </div>

      {uploading ? (
        <div
          role="progressbar"
          aria-label="正在上传头像"
          className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      ) : null}

      {uploadFeedback ? (
        <InlineAlert variant={uploadFeedback.variant}>
          <span>{uploadFeedback.message}</span>
          {pendingAvatar ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={uploading}
              onClick={() => saveUploadedAvatar(pendingAvatar)}
            >
              重试保存头像
            </Button>
          ) : null}
        </InlineAlert>
      ) : null}

      <form action={profileAction} className="flex max-w-sm flex-col gap-4">
        <Field
          data-invalid={Boolean(profileState.fieldErrors?.displayName)}
          data-disabled={profilePending || undefined}
        >
          <FieldLabel htmlFor="profile-display-name">昵称</FieldLabel>
          <Input
            id="profile-display-name"
            name="displayName"
            defaultValue={displayName}
            minLength={1}
            maxLength={80}
            required
            disabled={profilePending}
            aria-invalid={Boolean(profileState.fieldErrors?.displayName) || undefined}
            aria-describedby={
              profileState.fieldErrors?.displayName
                ? "profile-display-name-error"
                : "profile-display-name-description"
            }
          />
          <FieldDescription id="profile-display-name-description">
            其他协作者会看到此昵称，最多 80 个字符。
          </FieldDescription>
          {profileState.fieldErrors?.displayName ? (
            <FieldError id="profile-display-name-error">
              {profileState.fieldErrors.displayName}
            </FieldError>
          ) : null}
        </Field>

        {profileState.message ? (
          <InlineAlert
            variant={profileState.status === "success" ? "success" : "error"}
          >
            {profileState.message}
          </InlineAlert>
        ) : null}

        <Button type="submit" className="self-start" disabled={uploadDisabled}>
          {profilePending ? (
            <>
              <Spinner aria-hidden="true" data-icon="inline-start" />
              保存中…
            </>
          ) : (
            "保存昵称"
          )}
        </Button>
      </form>
    </div>
  );
}
