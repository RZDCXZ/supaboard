import type { RealtimeChannel } from "@supabase/supabase-js";

import {
  createAdminClient,
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

test("工作区成员互相看到在线与评论输入状态", async (
  { alicePage, browser, actors, loginAs, multiTenantWorkspaces },
  testInfo,
) => {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL 未配置");

  const bobContext = await browser.newContext({ baseURL });
  const bobPage = await bobContext.newPage();
  const { alphaId } = multiTenantWorkspaces;
  const taskTitle = `Presence task ${testInfo.parallelIndex}`;
  const aliceClient = await createAuthenticatedClient(actors.alice);

  try {
    const { error: taskError } = await aliceClient.from("tasks").insert({
      workspace_id: alphaId,
      title: taskTitle,
      created_by: actors.alice.id,
    });
    if (taskError) throw new Error(`无法创建 Presence 测试任务: ${taskError.message}`);

    await loginAs(bobPage, actors.bob);
    await Promise.all([
      alicePage.goto(`/app/workspaces/${alphaId}`),
      bobPage.goto(`/app/workspaces/${alphaId}`),
    ]);

    await expect(
      alicePage.getByRole("status", {
        name: "实时同步状态",
        includeHidden: true,
      }),
    ).toHaveText("实时同步：已连接");
    await expect(
      bobPage.getByRole("status", {
        name: "实时同步状态",
        includeHidden: true,
      }),
    ).toHaveText("实时同步：已连接");
    await expect(alicePage.getByLabel("在线成员")).toContainText("在线 2");
    await expect(bobPage.getByLabel("在线成员")).toContainText("在线 2");
    await expect(
      alicePage.getByRole("button", { name: new RegExp(taskTitle) }),
    ).toHaveCount(1);
    await expect(
      bobPage.getByRole("button", { name: new RegExp(taskTitle) }),
    ).toHaveCount(1);
    await Promise.all([
      alicePage.getByRole("button", { name: new RegExp(taskTitle) }).click(),
      bobPage.getByRole("button", { name: new RegExp(taskTitle) }).click(),
    ]);
    const aliceDrawer = alicePage.getByRole("dialog", { name: taskTitle });
    const bobDrawer = bobPage.getByRole("dialog", { name: taskTitle });

    await Promise.all([
      expect(aliceDrawer).toBeVisible(),
      expect(bobDrawer).toBeVisible(),
    ]);
    await expect(
      alicePage.getByRole("status", {
        name: "实时同步状态",
        includeHidden: true,
      }),
    ).toHaveText("实时同步：已连接");
    await expect(
      bobPage.getByRole("status", {
        name: "实时同步状态",
        includeHidden: true,
      }),
    ).toHaveText("实时同步：已连接");
    await expect(alicePage.getByLabel("在线成员")).toContainText("在线 2");

    await bobDrawer.getByRole("textbox", { name: "评论" }).fill("正在输入评论");
    await expect(
      aliceDrawer.getByRole("status", { name: "评论输入状态" }),
    ).toHaveText(`${actors.bob.displayName} 正在输入…`);
    await expect(
      aliceDrawer.getByRole("status", { name: "评论输入状态" }),
    ).toHaveCount(0, { timeout: 5_000 });
  } finally {
    await aliceClient.auth.signOut();
    await bobContext.close();
  }
});

test("非成员与被移除成员不能加入工作区私有频道", async ({
  actors,
  multiTenantWorkspaces,
}) => {
  const { alphaId } = multiTenantWorkspaces;
  const admin = createAdminClient();
  const charlieClient = await createAuthenticatedClient(actors.charlie);
  const bobClient = await createAuthenticatedClient(actors.bob);
  let removedBobClient: Awaited<ReturnType<typeof createAuthenticatedClient>> | null = null;
  const charlieChannel = charlieClient
    .channel(`workspace:${alphaId}`, {
      config: { private: true, presence: { key: actors.charlie.id } },
    })
    .on("presence", { event: "sync" }, () => undefined)
    .on("broadcast", { event: "typing" }, () => undefined);
  const bobChannel = bobClient
    .channel(`workspace:${alphaId}`, {
      config: {
        private: true,
        presence: { key: actors.bob.id },
        broadcast: { ack: true },
      },
    })
    .on("presence", { event: "sync" }, () => undefined)
    .on("broadcast", { event: "typing" }, () => undefined);

  try {
    await Promise.all([
      charlieClient.realtime.setAuth(),
      bobClient.realtime.setAuth(),
    ]);
    await expect(waitForChannelResult(charlieChannel)).resolves.toBe("CHANNEL_ERROR");
    await expect(waitForChannelResult(bobChannel)).resolves.toBe("SUBSCRIBED");
    await expect(
      bobChannel.track({
        userId: actors.bob.id,
        displayName: actors.bob.displayName,
        onlineAt: new Date().toISOString(),
      }),
    ).resolves.toBe("ok");
    await expect(
      bobChannel.send({
        type: "broadcast",
        event: "typing",
        payload: { taskId: crypto.randomUUID(), userId: actors.bob.id, isTyping: true },
      }),
    ).resolves.toBe("ok");

    const { error } = await admin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", alphaId)
      .eq("user_id", actors.bob.id);
    if (error) throw new Error(`无法移除 Bob 测试成员: ${error.message}`);

    await bobClient.removeChannel(bobChannel);
    await bobClient.auth.signOut();
    removedBobClient = await createAuthenticatedClient(actors.bob);
    await removedBobClient.realtime.setAuth();
    const removedBobChannel = removedBobClient
      .channel(`workspace:${alphaId}`, {
        config: { private: true, presence: { key: actors.bob.id } },
      })
      .on("presence", { event: "sync" }, () => undefined)
      .on("broadcast", { event: "typing" }, () => undefined);

    try {
      await expect(waitForChannelResult(removedBobChannel)).resolves.toBe(
        "CHANNEL_ERROR",
      );
    } finally {
      await removedBobClient.removeChannel(removedBobChannel);
    }
  } finally {
    await charlieClient.removeChannel(charlieChannel);
    await charlieClient.auth.signOut();
    await bobClient.removeChannel(bobChannel);
    await bobClient.auth.signOut();
    if (removedBobClient) await removedBobClient.auth.signOut();
  }
});
