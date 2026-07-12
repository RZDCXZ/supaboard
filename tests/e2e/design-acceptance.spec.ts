import { expect, test } from "./fixtures/auth";

test("窄屏没有水平溢出且核心任务操作可访问", async ({
  alicePage,
  multiTenantWorkspaces,
}) => {
  await alicePage.setViewportSize({ width: 390, height: 844 });
  await alicePage.goto(`/app/workspaces/${multiTenantWorkspaces.alphaId}`);

  await expect(
    alicePage.getByRole("heading", { name: multiTenantWorkspaces.alphaName }),
  ).toBeVisible();
  await expect(
    alicePage.getByRole("button", { name: "打开导航" }),
  ).toBeVisible();
  await expect(
    alicePage.getByRole("button", { name: "新建任务" }).first(),
  ).toBeVisible();
  expect(
    await alicePage.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await alicePage.getByRole("button", { name: "新建任务" }).first().click();
  const dialog = alicePage.getByRole("dialog", { name: "新建任务" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("标题")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "创建", exact: true }),
  ).toBeVisible();
});
