import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext } from "@playwright/test";

import type { Database } from "../../src/types/database";

type MailpitSummary = {
  ID: string;
  To: Array<{ Address: string }>;
};

type MailpitMessage = {
  HTML?: string;
  Text?: string;
};

function readPublicSupabaseEnv() {
  const content = readFileSync(".env.local", "utf8");
  const values = new Map<string, string>();

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    values.set(match[1], match[2].replace(/^['"]|['"]$/g, ""));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? values.get("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    values.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!url || !key) {
    throw new Error("缺少 Playwright 所需的公开 Supabase 环境变量");
  }

  return { url, key };
}

async function getLatestMailLink(request: APIRequestContext, email: string): Promise<string> {
  await expect
    .poll(
      async () => {
        const response = await request.get("http://localhost:54324/api/v1/messages");
        const body = (await response.json()) as { messages: MailpitSummary[] };

        return body.messages.find((message) =>
          message.To.some(({ Address }) => Address === email),
        )?.ID;
      },
      { timeout: 10_000 },
    )
    .not.toBeUndefined();

  const listResponse = await request.get("http://localhost:54324/api/v1/messages");
  const list = (await listResponse.json()) as { messages: MailpitSummary[] };
  const messageId = list.messages.find((message) =>
    message.To.some(({ Address }) => Address === email),
  )?.ID;

  if (!messageId) throw new Error("Mailpit 中没有找到测试邮件");

  const messageResponse = await request.get(
    `http://localhost:54324/api/v1/message/${messageId}`,
  );
  const message = (await messageResponse.json()) as MailpitMessage;
  const content = `${message.Text ?? ""}\n${message.HTML ?? ""}`.replaceAll("&amp;", "&");
  const link = content.match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/)?.[0];

  if (!link) throw new Error("测试邮件中没有找到 Auth 验证链接");
  return link;
}

test("成员可以完成任务 CRUD、筛选、统计和分页", async ({ page, request }) => {
  const email = `tasks-${Date.now()}@example.com`;
  const password = "password123";

  await page.goto("/signup");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码").fill(password);
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page.getByRole("heading", { name: "请检查邮箱" })).toBeVisible();

  await page.goto(await getLatestMailLink(request, email));
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
  await page.getByRole("option", { name: email.split("@")[0] }).click();
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
  await page.getByRole("option", { name: email.split("@")[0] }).click();
  await expect(page.getByRole("button", { name: /Updated task/ })).toBeVisible();
  await page.getByRole("button", { name: "清除筛选" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/workspaces/${workspaceId}$`));

  const { url, key } = readPublicSupabaseEnv();
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError || !authData.user) throw authError ?? new Error("测试用户登录失败");

  const { error: insertError } = await supabase.from("tasks").insert(
    Array.from({ length: 20 }, (_, index) => ({
      workspace_id: workspaceId,
      title: `Bulk task ${String(index + 1).padStart(2, "0")}`,
      created_by: authData.user.id,
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
