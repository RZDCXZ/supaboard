import { expect, test } from "./fixtures/auth";

test("成员可以评论并查看不可篡改的任务活动", async ({
  alicePage: page,
}) => {
  await page.getByRole("button", { name: "创建工作区" }).first().click();
  await page.getByLabel("名称").fill("Alpha Comments");
  await page.getByRole("button", { name: "创建", exact: true }).click();

  await page.getByRole("button", { name: "新建任务" }).first().click();
  const createDialog = page.getByRole("dialog", { name: "新建任务" });
  await createDialog.getByLabel("标题").fill("Stage 8 task");
  await createDialog.getByRole("button", { name: "创建", exact: true }).click();

  await page.getByRole("button", { name: /Stage 8 task/ }).click();
  const drawer = page.getByRole("dialog", { name: "Stage 8 task" });
  const commentInput = drawer.getByRole("textbox", { name: "评论" });
  await expect(drawer.getByRole("button", { name: "发表评论" })).toBeDisabled();
  await commentInput.fill("First comment");
  await drawer.getByRole("button", { name: "发表评论" }).click();
  await expect(drawer.getByText("First comment")).toBeVisible();

  await drawer.getByRole("button", { name: /删除 .* 的评论/ }).click();
  await expect(drawer.getByText("First comment")).toHaveCount(0);

  await drawer.getByRole("combobox", { name: "状态" }).click();
  await page.getByRole("option", { name: "已完成" }).click();
  await drawer.getByRole("button", { name: "Close" }).click();

  await page.getByRole("tab", { name: "活动" }).click();
  await expect(page).toHaveURL(/tab=activity/);
  await expect(page.getByText(/创建了任务“Stage 8 task”/)).toBeVisible();
  await expect(page.getByText(/将任务“Stage 8 task”从“待办”改为“已完成”/)).toHaveCount(1);
  await expect(page.getByRole("button", { name: "新建任务" })).toHaveCount(0);

  await page.getByRole("tab", { name: "任务" }).click();
  await page.getByRole("button", { name: /Stage 8 task/ }).click();
  const reopenedDrawer = page.getByRole("dialog", { name: "Stage 8 task" });
  await reopenedDrawer.getByRole("button", { name: "更多操作" }).click();
  await page.getByRole("menuitem", { name: "删除任务" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "删除任务" }).click();

  await page.getByRole("tab", { name: "活动" }).click();
  await expect(page.getByText(/删除了任务“Stage 8 task”/)).toBeVisible();
  await expect(page.getByText(/创建了任务“Stage 8 task”/)).toBeVisible();
});
