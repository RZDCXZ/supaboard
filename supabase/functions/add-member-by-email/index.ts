import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

import { handleAddMemberRequest } from "./handler.ts";

const appOrigin = Deno.env.get("APP_ORIGIN") ?? "http://localhost:3000";
const corsHeaders = {
  "Access-Control-Allow-Origin": appOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

const addMemberByEmailFunction = {
  fetch: withSupabase(
    { auth: "user", cors: corsHeaders },
    async (request, context) => {
      const requestId = crypto.randomUUID();

      return handleAddMemberRequest(request, {
        userId: context.userClaims?.id ?? null,
        requestId,
        allowedOrigin: appOrigin,
        isWorkspaceOwner: async (workspaceId) => {
          const { data, error } = await context.supabase
            .from("workspace_members")
            .select("user_id")
            .eq("workspace_id", workspaceId)
            .eq("user_id", context.userClaims?.id ?? "")
            .eq("role", "owner")
            .maybeSingle();
          if (error) throw new Error("OWNER_CHECK_FAILED");
          return Boolean(data);
        },
        findUserByEmail: async (email) => {
          const pageSize = 100;
          const maxPages = 10;

          for (let page = 1; page <= maxPages; page += 1) {
            const { data, error } = await context.supabaseAdmin.auth.admin.listUsers({
              page,
              perPage: pageSize,
            });
            if (error) throw new Error("AUTH_USER_LOOKUP_FAILED");

            const match = data.users.find(
              (user) => user.email?.trim().toLowerCase() === email,
            );
            if (match) return match.id;
            if (data.users.length < pageSize) return null;
          }

          return null;
        },
        insertMember: async ({ workspaceId, userId, addedBy }) => {
          const { error } = await context.supabaseAdmin
            .from("workspace_members")
            .insert({
              workspace_id: workspaceId,
              user_id: userId,
              role: "member",
              added_by: addedBy,
            });
          if (!error) return "inserted";
          return error.code === "23505" ? "exists" : "error";
        },
      });
    },
  ),
};

export default addMemberByEmailFunction;
