import {
  createAdminClient,
  createAuthenticatedClient,
  expect,
  test,
} from "./fixtures/auth";

async function createTask(
  actor: Parameters<typeof createAuthenticatedClient>[0],
  workspaceId: string,
  title: string,
) {
  const client = await createAuthenticatedClient(actor);
  const { data, error } = await client
    .from("tasks")
    .insert({ workspace_id: workspaceId, title, created_by: actor.id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

test("成员通过签名链接下载附件，只有上传者或 Owner 可以删除", async ({
  alicePage,
  actors,
  browser,
  loginAs,
  multiTenantWorkspaces,
}) => {
  const { alphaId } = multiTenantWorkspaces;
  const taskId = await createTask(actors.alice, alphaId, "Private attachment");
  await alicePage.goto(`/app/workspaces/${alphaId}?task=${taskId}`);
  await alicePage.getByLabel("附件文件").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("stage 11"),
  });
  await expect(alicePage.getByText("notes.txt")).toBeVisible();

  const bobContext = await browser.newContext({ acceptDownloads: true });
  const bobPage = await bobContext.newPage();
  await loginAs(bobPage, actors.bob);
  await bobPage.goto(`/app/workspaces/${alphaId}?task=${taskId}`);
  await expect(bobPage.getByText("notes.txt")).toBeVisible();
  await expect(
    bobPage.getByRole("button", { name: "删除附件 notes.txt" }),
  ).toHaveCount(0);
  const downloadPromise = bobPage.waitForEvent("download");
  await bobPage.getByRole("button", { name: "下载附件 notes.txt" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("notes.txt");
  await bobContext.close();

  const charlieContext = await browser.newContext();
  const charliePage = await charlieContext.newPage();
  await loginAs(charliePage, actors.charlie);
  await charliePage.goto(`/app/workspaces/${alphaId}?task=${taskId}`);
  await expect(charliePage.getByText("工作区不存在或无权访问")).toBeVisible();
  await charlieContext.close();

  await alicePage.getByRole("button", { name: "删除附件 notes.txt" }).click();
  await expect(alicePage.getByText("notes.txt")).toHaveCount(0);
  await expect(alicePage.getByText("当前任务还没有附件。")).toBeVisible();
});

test("删除任务前由 Edge Function 清理全部附件对象", async ({
  alicePage,
  actors,
  multiTenantWorkspaces,
}) => {
  const { alphaId } = multiTenantWorkspaces;
  const taskId = await createTask(actors.alice, alphaId, "Delete attachment task");
  await alicePage.goto(`/app/workspaces/${alphaId}?task=${taskId}`);
  await alicePage.getByLabel("附件文件").setInputFiles({
    name: "cleanup.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("pdf"),
  });
  await expect(alicePage.getByText("cleanup.pdf")).toBeVisible();

  const aliceClient = await createAuthenticatedClient(actors.alice);
  const { data: attachment, error: attachmentError } = await aliceClient
    .from("attachments")
    .select("object_path")
    .eq("task_id", taskId)
    .single();
  if (attachmentError) throw attachmentError;

  await alicePage.getByRole("button", { name: "更多操作" }).click();
  await alicePage.getByRole("menuitem", { name: "删除任务" }).click();
  await alicePage
    .getByRole("alertdialog", { name: /删除“Delete attachment task”/ })
    .getByRole("button", { name: "删除任务" })
    .click();
  await expect(alicePage.getByRole("dialog", { name: "Delete attachment task" })).toBeHidden();

  const admin = createAdminClient();
  const { count } = await admin
    .from("attachments")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId);
  expect(count).toBe(0);
  const { error: downloadError } = await admin.storage
    .from("attachments")
    .download(attachment.object_path);
  expect(downloadError).not.toBeNull();
});
