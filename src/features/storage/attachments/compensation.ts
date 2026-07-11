import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { ATTACHMENT_BUCKET } from "./validation";

export async function compensateAttachmentUpload(
  supabase: SupabaseClient<Database>,
  objectPath: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .remove([objectPath]);

  if (!error) return { ok: true };

  const requestId = crypto.randomUUID();
  console.error("Attachment upload compensation failed", { requestId });
  return {
    ok: false,
    message: "附件信息保存失败，临时文件也未能清理，请稍后重试",
  };
}

