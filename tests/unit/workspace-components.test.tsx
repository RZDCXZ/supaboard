import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { CreateWorkspaceDialog } from "@/features/workspaces/create-workspace-dialog";
import { WorkspaceList } from "@/features/workspaces/workspace-list";

vi.mock("@/features/workspaces/actions", () => ({
  createWorkspace: vi.fn(async () => ({ status: "idle" })),
}));

test("CreateWorkspaceDialog 打开后显示名称字段和操作按钮", () => {
  render(<CreateWorkspaceDialog />);

  fireEvent.click(screen.getByRole("button", { name: "创建工作区" }));

  expect(screen.getByRole("dialog", { name: "创建工作区" })).toBeVisible();
  expect(screen.getByLabelText("名称")).toBeVisible();
  expect(screen.getByRole("button", { name: "取消" })).toBeVisible();
  expect(screen.getByRole("button", { name: "创建" })).toBeVisible();
});

test("WorkspaceList 在空状态提供创建工作区入口", () => {
  render(<WorkspaceList workspaces={[]} />);

  expect(screen.getByText("还没有工作区")).toBeVisible();
  expect(screen.getByRole("button", { name: "创建工作区" })).toBeVisible();
});

test("WorkspaceList 渲染工作区链接和角色标签", () => {
  render(
    <WorkspaceList
      workspaces={[
        {
          id: "workspace-1",
          name: "Alpha",
          role: "owner",
          updatedAt: new Date().toISOString(),
          href: "/app/workspaces/workspace-1",
        },
        {
          id: "workspace-2",
          name: "Beta",
          role: "member",
          updatedAt: new Date(Date.now() - 60_000).toISOString(),
          href: "/app/workspaces/workspace-2",
        },
      ]}
    />,
  );

  expect(screen.getByRole("link", { name: /Alpha/ })).toHaveAttribute(
    "href",
    "/app/workspaces/workspace-1",
  );
  expect(screen.getByText("Owner")).toBeVisible();
  expect(screen.getByRole("link", { name: /Beta/ })).toHaveAttribute(
    "href",
    "/app/workspaces/workspace-2",
  );
  expect(screen.getByText("成员")).toBeVisible();
});
