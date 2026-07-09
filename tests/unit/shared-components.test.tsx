import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { expect, test } from "vitest";

import { AppDrawer } from "@/components/feedback/app-drawer";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function DrawerHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>打开详情</Button>
      <AppDrawer
        open={open}
        onOpenChange={setOpen}
        title="任务详情"
        description="查看任务内容"
      >
        <Button>抽屉操作</Button>
      </AppDrawer>
    </>
  );
}

test("InlineAlert 为错误和普通反馈提供正确的播报语义", () => {
  const { rerender } = render(
    <InlineAlert variant="error" title="保存失败">
      请检查输入
    </InlineAlert>,
  );

  expect(screen.getByRole("alert")).toHaveTextContent("保存失败");

  rerender(
    <InlineAlert variant="success" title="保存成功">
      已更新
    </InlineAlert>,
  );

  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
});

test("加载按钮同时提供 disabled 状态和可播报文案", () => {
  render(
    <Button disabled>
      <Spinner aria-hidden="true" data-icon="inline-start" />
      <span>正在保存…</span>
    </Button>,
  );

  expect(screen.getByRole("button", { name: "正在保存…" })).toBeDisabled();
});

test("密码输入可以切换可见状态并保留可访问名称", () => {
  render(
    <PasswordInput id="password" name="password" aria-describedby="password-error" />,
  );

  const input = screen.getByLabelText("密码");
  expect(input).toHaveAttribute("type", "password");
  expect(input).toHaveAttribute("aria-describedby", "password-error");

  fireEvent.click(screen.getByRole("button", { name: "显示密码" }));
  expect(input).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: "隐藏密码" })).toBeVisible();
});

test("AppDrawer 支持 Escape 关闭并把焦点还给触发按钮", async () => {
  render(<DrawerHarness />);

  const trigger = screen.getByRole("button", { name: "打开详情" });
  trigger.focus();
  fireEvent.click(trigger);

  expect(screen.getByRole("dialog", { name: "任务详情" })).toBeVisible();
  fireEvent.keyDown(document, { key: "Escape" });

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
});

test("PageHeader 组合标题、说明和页面操作", () => {
  render(
    <PageHeader
      title="工作区"
      description="查看你已加入的工作区"
      actions={<Button>创建工作区</Button>}
    />,
  );

  expect(screen.getByRole("heading", { name: "工作区" })).toBeVisible();
  expect(screen.getByText("查看你已加入的工作区")).toBeVisible();
  expect(screen.getByRole("button", { name: "创建工作区" })).toBeVisible();
});
