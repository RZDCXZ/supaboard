import { expect, test, type APIRequestContext } from "@playwright/test";

type MailpitSummary = {
  ID: string;
  To: Array<{ Address: string }>;
};

type MailpitMessage = {
  HTML?: string;
  Text?: string;
};

async function getLatestMailLink(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  await expect
    .poll(
      async () => {
        const response = await request.get(
          "http://localhost:54324/api/v1/messages",
        );
        const body = (await response.json()) as { messages: MailpitSummary[] };

        return body.messages.find((message) =>
          message.To.some(({ Address }) => Address === email),
        )?.ID;
      },
      { timeout: 10_000 },
    )
    .not.toBeUndefined();

  const listResponse = await request.get(
    "http://localhost:54324/api/v1/messages",
  );
  const list = (await listResponse.json()) as { messages: MailpitSummary[] };
  const messageId = list.messages.find((message) =>
    message.To.some(({ Address }) => Address === email),
  )?.ID;

  if (!messageId) {
    throw new Error("Mailpit 中没有找到测试邮件");
  }

  const messageResponse = await request.get(
    `http://localhost:54324/api/v1/message/${messageId}`,
  );
  const message = (await messageResponse.json()) as MailpitMessage;
  const content = `${message.Text ?? ""}\n${message.HTML ?? ""}`.replaceAll(
    "&amp;",
    "&",
  );
  const link = content.match(/https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/)?.[0];

  if (!link) {
    throw new Error("测试邮件中没有找到 Auth 验证链接");
  }

  return link;
}

test("用户可以创建工作区并在列表和边栏看到它", async ({ page, request }) => {
  const email = `workspace-${Date.now()}@example.com`;
  const password = "password123";

  await page.goto("/signup");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByLabel("确认密码").fill(password);
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page.getByRole("heading", { name: "请检查邮箱" })).toBeVisible();

  await page.goto(await getLatestMailLink(request, email));
  await expect(page).toHaveURL(/\/app$/);
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
