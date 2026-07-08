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

test("邮箱注册、会话刷新、登出和密码恢复", async ({ page, request }) => {
  const email = `auth-${Date.now()}@example.com`;
  const oldPassword = "password123";
  const newPassword = "new-password123";

  await page.goto("/signup");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill(oldPassword);
  await page.getByLabel("确认密码").fill(oldPassword);
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page.getByRole("heading", { name: "请检查邮箱" })).toBeVisible();

  await page.goto(await getLatestMailLink(request, email));
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "工作区" })).toBeVisible();
  await expect(page.getByText("还没有工作区", { exact: true })).toHaveCount(2);

  await page.reload();
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole("link", { name: "设置", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);

  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill(oldPassword);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.setViewportSize({ width: 900, height: 800 });
  await page.reload();
  const navigationTrigger = page.getByRole("button", { name: "打开导航" });
  await expect(navigationTrigger).toBeVisible();
  await navigationTrigger.focus();
  await navigationTrigger.press("Enter");
  await expect(page.getByRole("dialog", { name: "应用导航" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "应用导航" })).toBeHidden();
  await expect(navigationTrigger).toBeFocused();

  await page.goto("/app/settings");
  await page.getByRole("button", { name: "退出登录" }).click();

  await page.goto("/forgot-password");
  await page.getByLabel("邮箱").fill(email);
  await page.getByRole("button", { name: "发送重置邮件" }).click();
  await expect(page.getByText("如果该邮箱已注册")).toBeVisible();

  await page.goto(await getLatestMailLink(request, email));
  await expect(page).toHaveURL(/\/update-password$/);
  await page.getByLabel("新密码", { exact: true }).fill(newPassword);
  await page.getByLabel("确认新密码").fill(newPassword);
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.goto("/app/settings");
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("无效 callback 不暴露原始错误", async ({ page }) => {
  await page.goto("/auth/callback?code=invalid&next=/update-password");
  await expect(page).toHaveURL(/\/login\?error=callback$/);
  await expect(page.getByText("登录链接无效或已过期")).toBeVisible();
  await expect(page.getByText("invalid")).toHaveCount(0);

  await page.goto("/update-password");
  await expect(
    page.getByRole("heading", { name: "恢复链接无效或已过期" }),
  ).toBeVisible();
});
