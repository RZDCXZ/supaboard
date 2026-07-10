import {
  createAuthenticatedClient,
  expect,
  test,
} from "./fixtures/auth";

test("成员可以完成任务 CRUD、筛选、统计和分页", async ({
  alicePage: page,
  actors,
}) => {
  await page.getByRole("button", { name: "创建工作区" }).first().click();
  await page.getByLabel("名称").fill("Alpha Tasks");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/workspaces\/[0-9a-f-]+$/);
  const workspaceId = page.url().match(/workspaces\/([0-9a-f-]+)/)?.[1];
  if (!workspaceId) throw new Error("没有从工作区 URL 读取到 ID");

  await page.getByRole("button", { name: "新建任务" }).first().click();
  const createDialog = page.getByRole("dialog", { name: "新建任务" });
  await createDialog.getByLabel("标题").fill("   ");
  await createDialog.getByRole("button", { name: "创建", exact: true }).click();
  await expect(createDialog.getByText("请输入任务标题")).toBeVisible();

  await createDialog.getByLabel("标题").fill("First task");
  await createDialog.getByRole("button", { name: "创建", exact: true }).click();
  await expect(createDialog).toBeHidden();
  await expect(page.getByRole("button", { name: /First task/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /First task/ })).toContainText("优先级：中");

  const stats = page.getByLabel("任务统计");
  await expect(stats.locator('[data-slot="card"]').filter({ hasText: "全部" })).toContainText("1");
  await expect(stats.locator('[data-slot="card"]').filter({ hasText: "待办" })).toContainText("1");

  await page.getByRole("button", { name: /First task/ }).click();
  const drawer = page.getByRole("dialog", { name: "First task" });
  await expect(page).toHaveURL(new RegExp(`task=[0-9a-f-]+`));
  await drawer.getByLabel("标题").fill("Updated task");
  await drawer.getByRole("button", { name: "保存标题" }).click();
  const renamedDrawer = page.getByRole("dialog", { name: "Updated task" });
  await expect(renamedDrawer.getByLabel("标题")).toHaveValue("Updated task");
  await renamedDrawer.getByLabel("描述").fill("Stage 7 details");
  await renamedDrawer.getByRole("button", { name: "保存描述" }).click();
  await expect(renamedDrawer.getByLabel("描述")).toHaveValue("Stage 7 details");

  await renamedDrawer.getByRole("combobox", { name: "状态" }).click();
  await page.getByRole("option", { name: "已完成" }).click();
  await renamedDrawer.getByRole("combobox", { name: "优先级" }).click();
  await page.getByRole("option", { name: "高" }).click();
  await renamedDrawer.getByRole("combobox", { name: "负责人" }).click();
  await page.getByRole("option", { name: actors.alice.displayName }).click();
  await expect(stats.locator('[data-slot="card"]').filter({ hasText: "已完成" })).toContainText(
    "1",
  );

  await renamedDrawer.getByRole("button", { name: "Close" }).click();
  await expect(renamedDrawer).toBeHidden();
  await page.getByRole("combobox", { name: "状态筛选" }).click();
  await page.getByRole("option", { name: "已完成" }).click();
  await expect(page).toHaveURL(/status=done/);
  await page.reload();
  await expect(page.getByRole("button", { name: /Updated task/ })).toBeVisible();

  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/workspaces/${workspaceId}$`));
  await page.getByRole("combobox", { name: "负责人筛选" }).click();
  await page.getByRole("option", { name: actors.alice.displayName }).click();
  await expect(page.getByRole("button", { name: /Updated task/ })).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/workspaces/${workspaceId}$`));

  const supabase = await createAuthenticatedClient(actors.alice);

  const { error: insertError } = await supabase.from("tasks").insert(
    Array.from({ length: 20 }, (_, index) => ({
      workspace_id: workspaceId,
      title: `Bulk task ${String(index + 1).padStart(2, "0")}`,
      created_by: actors.alice.id,
    })),
  );
  if (insertError) throw insertError;

  await page.reload();
  await expect(page.getByText("1–20 / 共 21 条")).toBeVisible();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("button", { name: /Updated task/ })).toBeVisible();

  await page.getByRole("button", { name: /Updated task/ }).click();
  const updatedDrawer = page.getByRole("dialog", { name: "Updated task" });
  await updatedDrawer.getByRole("button", { name: "更多操作" }).click();
  await page.getByRole("menuitem", { name: "删除任务" }).click();
  const deleteDialog = page.getByRole("alertdialog", { name: /删除“Updated task”/ });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "删除任务" }).click();
  await expect(updatedDrawer).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/app/workspaces/${workspaceId}(?:\\?.*)?$`));
  await expect(page.getByText("1–20 / 共 20 条")).toBeVisible();
  await expect(page.getByRole("button", { name: /Updated task/ })).toHaveCount(0);
});
