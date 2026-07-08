import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { AppShell } from "@/components/app-shell/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
}));

test("AppShell 显示用户、总览、设置和真实工作区空状态", () => {
  render(
    <AppShell
      user={{ displayName: "Alice", avatarUrl: null }}
      workspaces={[]}
    >
      <p>页面内容</p>
    </AppShell>,
  );

  expect(screen.getAllByText("SupaBoard")).toHaveLength(2);
  expect(screen.getByText("Alice")).toBeVisible();
  expect(screen.getByRole("link", { name: "工作区总览" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "设置" })).toBeVisible();
  expect(screen.getByText("还没有工作区")).toBeVisible();
  expect(screen.queryByRole("button", { name: "创建工作区" })).not.toBeInTheDocument();
  expect(screen.getByText("页面内容")).toBeVisible();
});
