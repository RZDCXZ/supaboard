import { expect, test } from "./fixtures/auth";

test("用户可以创建工作区并在列表和边栏看到它", async ({
  alicePage: page,
}) => {
  await expect(page.getByRole("heading", { name: "工作区" })).toBeVisible();
  await expect(page.getByText("还没有工作区", { exact: true })).toHaveCount(2);

  await page.getByRole("button", { name: "创建工作区" }).first().click();
  await expect(page.getByRole("dialog", { name: "创建工作区" })).toBeVisible();
  await page.getByLabel("名称").fill("   ");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page.getByText("请输入工作区名称")).toBeVisible();

  await page.getByLabel("名称").fill("Alpha");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/workspaces\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Alpha" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Alpha" })).toBeVisible();

  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "工作区" })).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: /Alpha/ })).toBeVisible();
  await expect(page.getByText("Owner")).toBeVisible();
});
