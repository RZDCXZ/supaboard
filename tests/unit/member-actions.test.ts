import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addWorkspaceMember,
  removeWorkspaceMember,
} from "@/features/members/actions";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const memberId = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

function client({
  userId = ownerId,
  invoke = vi.fn(),
  builder,
}: {
  userId?: string | null;
  invoke?: ReturnType<typeof vi.fn>;
  builder?: Record<string, unknown>;
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
    functions: { invoke },
    from: vi.fn(() => builder),
  };
}

describe("member actions", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("在创建客户端前校验添加成员输入", async () => {
    await expect(
      addWorkspaceMember({ workspaceId: "bad", email: "not-an-email" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "请检查成员邮箱后重试",
        fields: { email: "请输入有效的邮箱地址" },
      },
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("标准化邮箱并通过 Edge Function 添加成员", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { member: { userId: memberId, role: "member" } },
      error: null,
    });
    mocks.createClient.mockResolvedValue(client({ invoke }));

    await expect(
      addWorkspaceMember({
        workspaceId,
        email: "  MEMBER@Example.COM  ",
      }),
    ).resolves.toEqual({
      ok: true,
      data: { userId: memberId, role: "member" },
    });
    expect(invoke).toHaveBeenCalledWith("add-member-by-email", {
      body: { workspaceId, email: "member@example.com" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/app/workspaces/${workspaceId}`,
    );
  });

  it.each([
    [404, "USER_NOT_FOUND", "未找到该用户，请让对方先完成注册"],
    [409, "MEMBER_ALREADY_EXISTS", "该用户已经是工作区成员"],
    [403, "FORBIDDEN", "只有工作区 Owner 可以添加成员"],
  ] as const)("映射 Edge Function 业务错误", async (status, code, message) => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: {
        context: Response.json(
          { error: { code, message, requestId: "request-123" } },
          { status },
        ),
      },
    });
    mocks.createClient.mockResolvedValue(client({ invoke }));

    await expect(
      addWorkspaceMember({ workspaceId, email: "member@example.com" }),
    ).resolves.toMatchObject({ ok: false, error: { code, message } });
  });

  it("Owner 只删除普通成员行", async () => {
    const builder = {
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    builder.delete.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({
      data: { user_id: memberId },
      error: null,
    });
    mocks.createClient.mockResolvedValue(client({ builder }));

    await expect(
      removeWorkspaceMember({ workspaceId, userId: memberId }),
    ).resolves.toEqual({ ok: true, data: memberId });
    expect(builder.eq.mock.calls).toEqual([
      ["workspace_id", workspaceId],
      ["user_id", memberId],
      ["role", "member"],
    ]);
  });

  it("不把无权删除或 Owner 行误报为成功", async () => {
    const builder = {
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    builder.delete.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.createClient.mockResolvedValue(client({ builder }));

    await expect(
      removeWorkspaceMember({ workspaceId, userId: memberId }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "成员不存在、不能移除 Owner，或你没有管理权限",
      },
    });
  });
});
