import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWorkspace } from "@/features/workspaces/actions";
import { initialWorkspaceActionState } from "@/features/workspaces/types";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
    },
    rpc: mocks.rpc,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

function formData(name: string) {
  const data = new FormData();
  data.set("name", name);
  return data;
}

describe("createWorkspace action", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.redirect.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.rpc.mockReset();
  });

  it("returns field errors for invalid names", async () => {
    const result = await createWorkspace(initialWorkspaceActionState, formData("   "));

    expect(result).toEqual({
      status: "error",
      code: "VALIDATION_ERROR",
      message: "请检查输入后重试",
      fieldErrors: { name: "请输入工作区名称" },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await createWorkspace(initialWorkspaceActionState, formData("Alpha"));

    expect(result).toEqual({
      status: "error",
      code: "NOT_AUTHENTICATED",
      message: "请先登录后再创建工作区",
    });
  });

  it("calls the RPC, revalidates, and redirects to the new workspace", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: "workspace-1",
      error: null,
    });

    await createWorkspace(initialWorkspaceActionState, formData("  Alpha  "));

    expect(mocks.rpc).toHaveBeenCalledWith("create_workspace", { name: "Alpha" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app");
    expect(mocks.redirect).toHaveBeenCalledWith("/app/workspaces/workspace-1");
  });

  it("maps permission errors to a stable forbidden response", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501" },
    });

    const result = await createWorkspace(initialWorkspaceActionState, formData("Alpha"));

    expect(result).toEqual({
      status: "error",
      code: "FORBIDDEN",
      message: "你没有权限执行此操作",
    });
  });
});
