import "@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  createContextClient,
  verifyAuth,
} from "@supabase/server/core";

import {
  addMemberAuthenticationErrorResponse,
  handleAddMemberRequest,
} from "./handler.ts";

const appOrigin = Deno.env.get("APP_ORIGIN") ?? "http://localhost:3000";
const corsHeaders = {
  "Access-Control-Allow-Origin": appOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const addMemberByEmailFunction = {
  fetch: async (request: Request) => {
    const requestId = crypto.randomUUID();
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    const { data: auth, error: authError } = await verifyAuth(request, {
      auth: "user",
    });
    if (authError || !auth.userClaims) {
      return withCors(addMemberAuthenticationErrorResponse(requestId));
    }

    const userClient = createContextClient({
      auth: { token: auth.token, keyName: auth.keyName },
    });
    const userId = auth.userClaims.id;

    const response = await handleAddMemberRequest(request, {
      userId,
      requestId,
      allowedOrigin: appOrigin,
      isWorkspaceOwner: async (workspaceId) => {
        const { data, error } = await userClient
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", userId)
          .eq("role", "owner")
          .maybeSingle();
        if (error) throw new Error("OWNER_CHECK_FAILED");
        return Boolean(data);
      },
      createAdminServices: () => {
        const adminClient = createAdminClient();

        return {
          findUserByEmail: async (email) => {
            const pageSize = 100;
            const maxPages = 10;

            for (let page = 1; page <= maxPages; page += 1) {
              const { data, error } = await adminClient.auth.admin.listUsers({
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
            const { error } = await adminClient
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
        };
      },
    });

    return withCors(response);
  },
};

export default addMemberByEmailFunction;
