import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

import { handleDeleteTaskRequest } from "./handler.ts";

const ATTACHMENT_BUCKET = "attachments";
const REMOVE_BATCH_SIZE = 100;

const deleteTaskFunction = {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    const requestId = crypto.randomUUID();

    return handleDeleteTaskRequest(request, {
      userId: context.userClaims?.id ?? null,
      requestId,
      canDeleteTask: async ({ workspaceId, taskId }) => {
        const { data, error } = await context.supabase
          .from("tasks")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("id", taskId)
          .maybeSingle();
        return !error && Boolean(data);
      },
      listAttachmentPaths: async ({ workspaceId, taskId }) => {
        const { data, error } = await context.supabase
          .from("attachments")
          .select("object_path")
          .eq("workspace_id", workspaceId)
          .eq("task_id", taskId);
        return error ? null : (data ?? []).map(({ object_path }) => object_path);
      },
      removeAttachmentObjects: async (paths) => {
        for (let index = 0; index < paths.length; index += REMOVE_BATCH_SIZE) {
          const batch = paths.slice(index, index + REMOVE_BATCH_SIZE);
          const { error } = await context.supabaseAdmin.storage
            .from(ATTACHMENT_BUCKET)
            .remove([...batch]);
          if (error) return false;
        }
        return true;
      },
      deleteTask: async ({ workspaceId, taskId }) => {
        const { data, error } = await context.supabase
          .from("tasks")
          .delete()
          .eq("workspace_id", workspaceId)
          .eq("id", taskId)
          .select("id")
          .maybeSingle();
        return !error && Boolean(data);
      },
    });
  }),
};

export default deleteTaskFunction;
