import {
  addMemberByEmailSchema,
  type AddMemberByEmailInput,
} from "./schema.ts";

type InsertMemberInput = {
  workspaceId: string;
  userId: string;
  addedBy: string;
};

export type AddMemberAdminServices = {
  findUserByEmail: (email: string) => Promise<string | null>;
  insertMember: (
    input: InsertMemberInput,
  ) => Promise<"inserted" | "exists" | "error">;
};

export type AddMemberServices = {
  userId: string | null;
  requestId: string;
  allowedOrigin: string;
  isWorkspaceOwner: (workspaceId: string) => Promise<boolean>;
  createAdminServices: () => AddMemberAdminServices;
};

type AddMemberErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "VALIDATION_ERROR"
  | "NOT_AUTHENTICATED"
  | "ORIGIN_NOT_ALLOWED"
  | "FORBIDDEN"
  | "USER_NOT_FOUND"
  | "MEMBER_ALREADY_EXISTS"
  | "INTERNAL_ERROR";

function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
) {
  return Response.json(body, {
    status,
    headers: { "x-request-id": requestId },
  });
}

function errorResponse(
  status: number,
  code: AddMemberErrorCode,
  message: string,
  requestId: string,
) {
  return jsonResponse(
    { error: { code, message, requestId } },
    status,
    requestId,
  );
}

export function addMemberAuthenticationErrorResponse(requestId: string) {
  return errorResponse(
    401,
    "NOT_AUTHENTICATED",
    "请先登录后再添加成员",
    requestId,
  );
}

async function parseRequest(request: Request): Promise<
  | { ok: true; data: AddMemberByEmailInput }
  | { ok: false }
> {
  try {
    const parsed = addMemberByEmailSchema.safeParse(await request.json());
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function handleAddMemberRequest(
  request: Request,
  services: AddMemberServices,
) {
  if (request.method !== "POST") {
    return errorResponse(
      405,
      "METHOD_NOT_ALLOWED",
      "仅支持 POST 请求",
      services.requestId,
    );
  }

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== services.allowedOrigin) {
    return errorResponse(
      403,
      "ORIGIN_NOT_ALLOWED",
      "请求来源不受允许",
      services.requestId,
    );
  }

  if (!services.userId) {
    return addMemberAuthenticationErrorResponse(services.requestId);
  }

  const parsed = await parseRequest(request);
  if (!parsed.ok) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "请求参数不正确",
      services.requestId,
    );
  }

  try {
    if (!(await services.isWorkspaceOwner(parsed.data.workspaceId))) {
      return errorResponse(
        403,
        "FORBIDDEN",
        "只有工作区 Owner 可以添加成员",
        services.requestId,
      );
    }

    const admin = services.createAdminServices();
    const targetUserId = await admin.findUserByEmail(parsed.data.email);
    if (!targetUserId) {
      return errorResponse(
        404,
        "USER_NOT_FOUND",
        "未找到该用户，请让对方先完成注册",
        services.requestId,
      );
    }

    const insertResult = await admin.insertMember({
      workspaceId: parsed.data.workspaceId,
      userId: targetUserId,
      addedBy: services.userId,
    });
    if (insertResult === "exists") {
      return errorResponse(
        409,
        "MEMBER_ALREADY_EXISTS",
        "该用户已经是工作区成员",
        services.requestId,
      );
    }
    if (insertResult === "error") throw new Error("MEMBER_INSERT_FAILED");

    return jsonResponse(
      { member: { userId: targetUserId, role: "member" } },
      200,
      services.requestId,
    );
  } catch (error) {
    const failure =
      error instanceof Error &&
      [
        "OWNER_CHECK_FAILED",
        "AUTH_USER_LOOKUP_FAILED",
        "MEMBER_INSERT_FAILED",
      ].includes(error.message)
        ? error.message
        : "UNEXPECTED_FAILURE";
    console.error("add-member-by-email failed", {
      requestId: services.requestId,
      failure,
    });
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "暂时无法添加成员，请稍后重试",
      services.requestId,
    );
  }
}
