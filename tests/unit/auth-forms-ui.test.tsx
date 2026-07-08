import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("@/features/auth/actions", () => ({
  login: vi.fn(),
  requestPasswordReset: vi.fn(),
  signup: vi.fn(),
  updatePassword: vi.fn(),
}));

import { LoginForm } from "@/features/auth/auth-forms";
import { LogoutButton } from "@/features/auth/logout-button";

test("登录表单使用可切换的密码输入和原生禁用提交状态", () => {
  render(<LoginForm next="/app" />);

  const password = screen.getByLabelText("密码");
  expect(password).toHaveAttribute("type", "password");

  fireEvent.click(screen.getByRole("button", { name: "显示密码" }));
  expect(password).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "登录" })).not.toBeDisabled();
});

test("退出登录使用非危险按钮并保留原生提交语义", () => {
  render(<LogoutButton />);

  expect(screen.getByRole("button", { name: "退出登录" })).toHaveAttribute(
    "type",
    "submit",
  );
  expect(screen.getByRole("button", { name: "退出登录" })).toHaveAttribute(
    "data-variant",
    "outline",
  );
});
