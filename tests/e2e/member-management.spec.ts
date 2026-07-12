import type { RealtimeChannel } from "@supabase/supabase-js";

import {
  createAuthenticatedClient,
  expect,
  test,
} from "./fixtures/auth";

async function waitForChannelResult(channel: RealtimeChannel) {
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("等待 Realtime 频道状态超时")),
      10_000,
    );

    channel.subscribe((status) => {
      if (
        status === "SUBSCRIBED" ||
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        clearTimeout(timeout);
        resolve(status);
      }
    });
  });
}

test("Owner 按邮箱添加和移除成员，普通成员不能管理", async ({
  page,
  browser,
  actors,
  loginAs,
  multiTenantWorkspaces,
}, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL 未配置");

  const { alphaId } = multiTenantWorkspaces;
  const bobContext = await browser.newContext({ baseURL });
  const bobPage = await bobContext.newPage();

  try {
    await loginAs(bobPage, actors.bob);
    await bobPage.goto(`/app/workspaces/${alphaId}?tab=members`);
    await expect(bobPage.getByRole("button", { name: "添加成员" })).toHaveCount(0);
    await expect(bobPage.getByRole("button", { name: /移除/ })).toHaveCount(0);

    await loginAs(page, actors.alice);
    await page.goto(`/app/workspaces/${alphaId}?tab=members`);

    await page.getByRole("button", { name: "添加成员" }).click();
    const addDialog = page.getByRole("dialog", { name: "添加成员" });
    const email = addDialog.getByRole("textbox", { name: "邮箱" });
    await email.fill(actors.bob.email);
    await addDialog.getByRole("button", { name: "添加", exact: true }).click();
    await expect(addDialog.getByText("该用户已经是工作区成员")).toBeVisible();
    await expect(email).toHaveValue(actors.bob.email);

    await email.fill(`missing-${crypto.randomUUID()}@example.com`);
    await addDialog.getByRole("button", { name: "添加", exact: true }).click();
    await expect(
      addDialog.getByText("未找到该用户，请让对方先完成注册"),
    ).toBeVisible();
    await addDialog.getByRole("button", { name: "取消" }).click();

    await page.getByRole("button", { name: `移除 ${actors.bob.displayName}` }).click();
    const removeDialog = page.getByRole("alertdialog", {
      name: `移除 ${actors.bob.displayName}`,
    });
    await expect(removeDialog).toContainText(
      "后续请求和重新建立的实时连接将失去此工作区权限",
    );
    await removeDialog.getByRole("button", { name: "移除成员" }).click();
    await expect(page.getByText(actors.bob.displayName, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "添加成员" }).click();
    await page.getByRole("dialog", { name: "添加成员" })
      .getByRole("textbox", { name: "邮箱" })
      .fill(actors.bob.email);
    await page.getByRole("dialog", { name: "添加成员" })
      .getByRole("button", { name: "添加", exact: true })
      .click();
    await expect(page.getByText(actors.bob.displayName, { exact: true })).toBeVisible();

    const bobClient = await createAuthenticatedClient(actors.bob);
    await bobClient.realtime.setAuth();
    const channel = bobClient
      .channel(`workspace:${alphaId}`, {
        config: { private: true, presence: { key: actors.bob.id } },
      })
      .on("presence", { event: "sync" }, () => undefined);
    await expect(waitForChannelResult(channel)).resolves.toBe("SUBSCRIBED");

    await page.getByRole("button", { name: `移除 ${actors.bob.displayName}` }).click();
    await page.getByRole("alertdialog", { name: `移除 ${actors.bob.displayName}` })
      .getByRole("button", { name: "移除成员" })
      .click();
    await expect(page.getByText(actors.bob.displayName, { exact: true })).toHaveCount(0);

    await bobClient.removeChannel(channel);
    await bobClient.auth.signOut();
    const removedBobClient = await createAuthenticatedClient(actors.bob);
    await removedBobClient.realtime.setAuth();
    const removedChannel = removedBobClient
      .channel(`workspace:${alphaId}`, {
        config: { private: true, presence: { key: actors.bob.id } },
      })
      .on("presence", { event: "sync" }, () => undefined);
    try {
      await expect(waitForChannelResult(removedChannel)).resolves.toBe(
        "CHANNEL_ERROR",
      );
    } finally {
      await removedBobClient.removeChannel(removedChannel);
      await removedBobClient.auth.signOut();
    }
  } finally {
    await bobContext.close();
  }
});
