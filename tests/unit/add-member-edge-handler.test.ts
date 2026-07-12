import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleAddMemberRequest,
  type AddMemberServices,
} from "../../supabase/functions/add-member-by-email/handler";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";

function request(body: unknown, method = "POST") {
  return new Request("http://localhost/functions/v1/add-member-by-email", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function crossOriginRequest(body: unknown, origin: string) {
  return new Request("http://localhost/functions/v1/add-member-by-email", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

function services(
  overrides: Partial<AddMemberServices> = {},
): AddMemberServices {
  return {
    userId: ownerId,
    requestId: "request-123",
    allowedOrigin: "http://localhost:3000",
    isWorkspaceOwner: vi.fn().mockResolvedValue(true),
    createAdminServices: vi.fn(() => ({
      findUserByEmail: vi.fn().mockResolvedValue(memberId),
      insertMember: vi.fn().mockResolvedValue("inserted"),
    })),
    ...overrides,
  };
}

describe("add-member-by-email Edge handler", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("拒绝无效参数并返回 request ID", async () => {
    const response = await handleAddMemberRequest(
      request({ workspaceId: "bad", email: "not-an-email" }),
      services(),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBe("request-123");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "请求参数不正确",
        requestId: "request-123",
      },
    });
  });

  it("要求有效的用户身份", async () => {
    const response = await handleAddMemberRequest(
      request({ workspaceId, email: "member@example.com" }),
      services({ userId: null }),
    );

    expect(response.status).toBe(401);
  });

  it("在任何业务或管理员调用前拒绝未配置的浏览器 origin", async () => {
    const isWorkspaceOwner = vi.fn();
    const response = await handleAddMemberRequest(
      crossOriginRequest(
        { workspaceId, email: "member@example.com" },
        "https://evil.example",
      ),
      services({ isWorkspaceOwner }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ORIGIN_NOT_ALLOWED" },
    });
    expect(isWorkspaceOwner).not.toHaveBeenCalled();
  });

  it("在 Owner 权限通过前不使用管理员能力", async () => {
    const createAdminServices = vi.fn();
    const response = await handleAddMemberRequest(
      request({ workspaceId, email: "member@example.com" }),
      services({
        isWorkspaceOwner: vi.fn().mockResolvedValue(false),
        createAdminServices,
      }),
    );

    expect(response.status).toBe(403);
    expect(createAdminServices).not.toHaveBeenCalled();
  });

  it("标准化邮箱并返回新增成员", async () => {
    const events: string[] = [];
    const isWorkspaceOwner = vi.fn(async () => {
      events.push("owner");
      return true;
    });
    const findUserByEmail = vi.fn().mockResolvedValue(memberId);
    const insertMember = vi.fn().mockResolvedValue("inserted");
    const createAdminServices = vi.fn(() => {
      events.push("admin");
      return { findUserByEmail, insertMember };
    });
    const response = await handleAddMemberRequest(
      request({ workspaceId, email: "  MEMBER@Example.COM  " }),
      services({ isWorkspaceOwner, createAdminServices }),
    );

    expect(findUserByEmail).toHaveBeenCalledWith("member@example.com");
    expect(createAdminServices).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["owner", "admin"]);
    expect(insertMember).toHaveBeenCalledWith({
      workspaceId,
      userId: memberId,
      addedBy: ownerId,
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      member: { userId: memberId, role: "member" },
    });
  });

  it.each([
    [null, 404, "USER_NOT_FOUND"],
    [memberId, 409, "MEMBER_ALREADY_EXISTS"],
  ] as const)(
    "映射查找和重复成员结果",
    async (foundUserId, expectedStatus, expectedCode) => {
      const response = await handleAddMemberRequest(
        request({ workspaceId, email: "member@example.com" }),
        services({
          createAdminServices: () => ({
            findUserByEmail: vi.fn().mockResolvedValue(foundUserId),
            insertMember: vi.fn().mockResolvedValue("exists"),
          }),
        }),
      );

      expect(response.status).toBe(expectedStatus);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: expectedCode },
      });
    },
  );

  it("隐藏未预期错误并保留 request ID", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await handleAddMemberRequest(
      request({ workspaceId, email: "member@example.com" }),
      services({
        createAdminServices: () => ({
          findUserByEmail: vi.fn().mockResolvedValue(memberId),
          insertMember: vi.fn().mockResolvedValue("error"),
        }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INTERNAL_ERROR", requestId: "request-123" },
    });
  });
});
