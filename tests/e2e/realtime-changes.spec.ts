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

test("成员可跨窗口同步任务、评论、删除与断线恢复", async (
  {
    alicePage,
    browser,
    actors,
    loginAs,
    multiTenantWorkspaces,
  },
  testInfo,
) => {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL 未配置");

  const bobContext = await browser.newContext({ baseURL });
  const bobPage = await bobContext.newPage();
  const { alphaId } = multiTenantWorkspaces;
  const taskTitle = `Realtime task ${testInfo.parallelIndex}`;

  try {
    await loginAs(bobPage, actors.bob);
    await Promise.all([
      alicePage.goto(`/app/workspaces/${alphaId}`),
      bobPage.goto(`/app/workspaces/${alphaId}`),
    ]);
    await expect(
      alicePage.getByRole("status", { name: "实时同步状态" }),
    ).toHaveText("实时同步：已连接");
    await expect(
      bobPage.getByRole("status", { name: "实时同步状态" }),
    ).toHaveText("实时同步：已连接");

    await bobPage.getByRole("button", { name: "新建任务" }).first().click();
    const createDialog = bobPage.getByRole("dialog", { name: "新建任务" });
    await createDialog.getByLabel("标题").fill(taskTitle);
    await createDialog.getByRole("button", { name: "创建", exact: true }).click();

    await expect(
      alicePage.getByRole("button", { name: new RegExp(taskTitle) }),
    ).toHaveCount(1);
    await bobPage.getByRole("button", { name: new RegExp(taskTitle) }).click();
    await alicePage.getByRole("button", { name: new RegExp(taskTitle) }).click();
    const bobDrawer = bobPage.getByRole("dialog", { name: taskTitle });
    const aliceDrawer = alicePage.getByRole("dialog", { name: taskTitle });

    await aliceDrawer.getByRole("combobox", { name: "状态" }).click();
    await alicePage.getByRole("option", { name: "已完成" }).click();
    await expect(bobDrawer.getByRole("combobox", { name: "状态" })).toHaveText(
      "已完成",
    );

    await bobDrawer.getByRole("textbox", { name: "评论" }).fill("Bob realtime comment");
    await bobDrawer.getByRole("button", { name: "发表评论" }).click();
    await expect(aliceDrawer.getByText("Bob realtime comment")).toHaveCount(1);

    await aliceDrawer
      .getByRole("textbox", { name: "评论" })
      .fill("Alice realtime comment");
    await aliceDrawer.getByRole("button", { name: "发表评论" }).click();
    await expect(bobDrawer.getByText("Alice realtime comment")).toHaveCount(1);

    await aliceDrawer
      .getByRole("button", { name: `删除 ${actors.bob.displayName} 的评论` })
      .click();
    await expect(bobDrawer.getByText("Bob realtime comment")).toHaveCount(0);

    // 先完成一次稳定的服务端渲染，避免把仍在途的评论刷新请求与离线切换混在一起。
    await alicePage.reload();
    await expect(
      alicePage.getByRole("status", {
        name: "实时同步状态",
        includeHidden: true,
      }),
    ).toHaveText("实时同步：已连接");
    await expect(alicePage.getByRole("dialog", { name: taskTitle })).toBeVisible();

    await alicePage.context().setOffline(true);
    await expect(
      alicePage.getByRole("status", {
        name: "实时同步状态",
        includeHidden: true,
      }),
    ).toHaveText("实时同步：已断开");
    await bobDrawer.getByRole("combobox", { name: "优先级" }).click();
    await bobPage.getByRole("option", { name: "高" }).click();

    await alicePage.context().setOffline(false);
    await expect(
      alicePage.getByRole("status", {
        name: "实时同步状态",
        includeHidden: true,
      }),
    ).toHaveText("实时同步：已连接");
    await expect(
      alicePage.getByRole("dialog", { name: taskTitle }).getByRole("combobox", {
        name: "优先级",
      }),
    ).toHaveText("高");

    await bobDrawer.getByRole("button", { name: "更多操作" }).click();
    await bobPage.getByRole("menuitem", { name: "删除任务" }).click();
    await bobPage
      .getByRole("alertdialog")
      .getByRole("button", { name: "删除任务" })
      .click();

    await expect(alicePage.getByRole("dialog", { name: taskTitle })).toHaveCount(0);
    await expect(
      alicePage.getByRole("button", { name: new RegExp(taskTitle) }),
    ).toHaveCount(0);
  } finally {
    await bobContext.close();
  }
});

test("非成员不能加入工作区私有 Broadcast topic", async ({
  actors,
  multiTenantWorkspaces,
}) => {
  const charlieClient = await createAuthenticatedClient(actors.charlie);
  await charlieClient.realtime.setAuth();
  const channel = charlieClient
    .channel(`workspace:${multiTenantWorkspaces.alphaId}`, {
      config: { private: true },
    })
    .on("broadcast", { event: "DELETE" }, () => undefined);

  try {
    await expect(waitForChannelResult(channel)).resolves.toBe("CHANNEL_ERROR");
  } finally {
    await charlieClient.removeChannel(channel);
    await charlieClient.auth.signOut();
  }
});
