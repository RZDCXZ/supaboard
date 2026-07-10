import {
  expect,
  SEEDED_ACTORS,
  test,
} from "./fixtures/auth";

test("Seed Alice 可以登录并读取固定 Alpha 工作区", async ({
  page,
  loginAs,
}) => {
  await loginAs(page, SEEDED_ACTORS.alice);
  await page.goto("/app/workspaces/00000000-0000-4000-8000-000000000101?tab=members");

  await expect(page.getByRole("heading", { name: "Alpha" })).toBeVisible();
  await expect(page.getByText("2 位成员")).toBeVisible();
});

test("成员列表与负责人选项遵守工作区边界", async ({
  page,
  browser,
  actors,
  loginAs,
  multiTenantWorkspaces,
}) => {
  const { alphaId, alphaName } = multiTenantWorkspaces;

  await loginAs(page, actors.alice);
  await page.goto(`/app/workspaces/${alphaId}?tab=members`);

  await expect(page.getByRole("heading", { name: alphaName })).toBeVisible();
  await expect(page.getByText("2 位成员")).toBeVisible();
  const aliceMain = page.locator("main").last();
  const aliceRows = aliceMain.getByRole("listitem");
  await expect(aliceRows).toHaveCount(2);
  await expect(aliceRows.nth(0)).toContainText("Alice");
  await expect(aliceRows.nth(0)).toContainText("Owner");
  await expect(aliceRows.nth(1)).toContainText("Bob");
  await expect(aliceRows.nth(1)).toContainText("成员");
  await expect(aliceMain).not.toContainText(actors.alice.email);
  await expect(aliceMain).not.toContainText(actors.bob.email);
  await expect(page.getByRole("button", { name: /添加|移除|降级/ })).toHaveCount(0);

  await page.getByRole("tab", { name: "任务" }).click();
  await page.getByRole("button", { name: "新建任务" }).first().click();
  const createDialog = page.getByRole("dialog", { name: "新建任务" });
  await createDialog.getByRole("combobox", { name: "负责人" }).click();
  await expect(page.getByRole("option", { name: "Alice" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Bob" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Charlie" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await createDialog.getByRole("button", { name: "取消" }).click();

  const bobContext = await browser.newContext({ baseURL: "http://localhost:3000" });
  const charlieContext = await browser.newContext({
    baseURL: "http://localhost:3000",
  });

  try {
    const bobPage = await bobContext.newPage();
    await loginAs(bobPage, actors.bob);
    await bobPage.goto(`/app/workspaces/${alphaId}?tab=members`);
    const bobMain = bobPage.locator("main").last();
    await expect(bobMain.getByText("Alice")).toBeVisible();
    await expect(bobMain.getByText("Bob")).toBeVisible();
    await expect(bobMain).not.toContainText(actors.alice.email);
    await expect(bobPage.getByRole("button", { name: /添加|移除|降级/ })).toHaveCount(
      0,
    );

    const charliePage = await charlieContext.newPage();
    await loginAs(charliePage, actors.charlie);
    await charliePage.goto(`/app/workspaces/${alphaId}?tab=members`);
    await expect(
      charliePage.getByText("工作区不存在或无权访问"),
    ).toBeVisible();
    await expect(charliePage.getByText(alphaName)).toHaveCount(0);
    await expect(charliePage.getByText("Alice", { exact: true })).toHaveCount(0);
    await expect(charliePage.getByText("Bob", { exact: true })).toHaveCount(0);
  } finally {
    await bobContext.close();
    await charlieContext.close();
  }
});
