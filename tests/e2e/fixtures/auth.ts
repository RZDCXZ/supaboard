import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  expect,
  test as base,
  type Page,
} from "@playwright/test";

import type { Database } from "../../../src/types/database";

export type TestActor = {
  id: string;
  email: string;
  password: string;
  displayName: "Alice" | "Bob" | "Charlie";
};

export type TestActors = {
  alice: TestActor;
  bob: TestActor;
  charlie: TestActor;
};

export type MultiTenantWorkspaces = {
  alphaId: string;
  alphaName: string;
  betaId: string;
  betaName: string;
};

export const SEEDED_ACTORS: TestActors = {
  alice: {
    id: "00000000-0000-4000-8000-000000000011",
    email: "alice@example.com",
    password: "SupaBoard123!",
    displayName: "Alice",
  },
  bob: {
    id: "00000000-0000-4000-8000-000000000012",
    email: "bob@example.com",
    password: "SupaBoard123!",
    displayName: "Bob",
  },
  charlie: {
    id: "00000000-0000-4000-8000-000000000013",
    email: "charlie@example.com",
    password: "SupaBoard123!",
    displayName: "Charlie",
  },
};

type SupabaseTestConfig = {
  url: string;
  publishableKey: string;
  secretKey?: string;
};

type LoginAs = (page: Page, actor: TestActor) => Promise<void>;

type Fixtures = {
  actors: TestActors;
  loginAs: LoginAs;
  alicePage: Page;
  multiTenantWorkspaces: MultiTenantWorkspaces;
};

function readEnvFile(path: string) {
  let content = "";

  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const values = new Map<string, string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;

    values.set(match[1], match[2].replace(/^(['"])(.*)\1$/, "$2"));
  }

  return values;
}

function readSupabaseTestConfig(requireSecret = false): SupabaseTestConfig {
  const appEnv = readEnvFile(".env.local");
  const testEnv = readEnvFile(".env.test.local");
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    appEnv.get("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    appEnv.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? testEnv.get("SUPABASE_SECRET_KEY");

  if (!url || !publishableKey) {
    throw new Error("缺少 Playwright 所需的公开 Supabase 环境变量");
  }

  if (requireSecret && !secretKey) {
    throw new Error(
      "缺少 SUPABASE_SECRET_KEY；请将本地 Secret Key 写入 .env.test.local",
    );
  }

  return { url, publishableKey, secretKey };
}

function clientOptions() {
  return {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  } as const;
}

export async function createAuthenticatedClient(actor: TestActor) {
  const { url, publishableKey } = readSupabaseTestConfig();
  const client = createClient<Database>(url, publishableKey, clientOptions());
  const { error } = await client.auth.signInWithPassword({
    email: actor.email,
    password: actor.password,
  });

  if (error) throw new Error(`无法登录测试身份 ${actor.displayName}: ${error.message}`);
  return client;
}

export function createAdminClient() {
  const { url, secretKey } = readSupabaseTestConfig(true);
  return createClient<Database>(url, secretKey!, clientOptions());
}

async function loginAsActor(page: Page, actor: TestActor) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(actor.email);
  await page.getByLabel("密码", { exact: true }).fill(actor.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function deleteOwnedWorkspaces(
  admin: SupabaseClient<Database>,
  actors: readonly TestActor[],
) {
  const { data, error } = await admin
    .from("workspaces")
    .select("id")
    .in(
      "owner_id",
      actors.map((actor) => actor.id),
    );

  if (error) throw new Error(`无法读取测试工作区: ${error.message}`);

  for (const workspace of data ?? []) {
    const { data: attachments, error: attachmentError } = await admin
      .from("attachments")
      .select("object_path")
      .eq("workspace_id", workspace.id);
    if (attachmentError) {
      throw new Error(`无法读取测试附件: ${attachmentError.message}`);
    }
    if (attachments && attachments.length > 0) {
      const { error: storageError } = await admin.storage
        .from("attachments")
        .remove(attachments.map(({ object_path }) => object_path));
      if (storageError) {
        throw new Error(`无法清理测试附件对象: ${storageError.message}`);
      }
    }

    // 工作区级级联删除任务时，任务删除触发器会尝试写入仍引用该工作区的活动日志。
    // 先显式删除任务，让触发器在工作区仍存在时完成记录，再删除工作区并级联清理日志。
    const { error: taskDeleteError } = await admin
      .from("tasks")
      .delete()
      .eq("workspace_id", workspace.id);
    if (taskDeleteError) {
      throw new Error(`无法清理测试工作区任务 ${workspace.id}: ${taskDeleteError.message}`);
    }

    const { error: deleteError } = await admin
      .from("workspaces")
      .delete()
      .eq("id", workspace.id);
    if (deleteError) {
      throw new Error(`无法清理测试工作区 ${workspace.id}: ${deleteError.message}`);
    }
  }
}

async function deleteActorAvatars(
  admin: SupabaseClient<Database>,
  actors: readonly TestActor[],
) {
  const paths = actors.flatMap((actor) =>
    ["jpg", "jpeg", "png", "webp"].map(
      (extension) => `${actor.id}/avatar.${extension}`,
    ),
  );
  const { error } = await admin.storage.from("avatars").remove(paths);

  if (error) throw new Error(`无法清理测试头像: ${error.message}`);
}

async function createActor(
  admin: SupabaseClient<Database>,
  displayName: TestActor["displayName"],
  runId: string,
  password: string,
) {
  const email = `e2e-${displayName.toLowerCase()}-${runId}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: displayName },
  });

  if (error || !data.user) {
    throw new Error(`无法创建测试身份 ${displayName}: ${error?.message ?? "未知错误"}`);
  }

  return {
    id: data.user.id,
    email,
    password,
    displayName,
  } satisfies TestActor;
}

export const test = base.extend<Fixtures>({
  actors: async ({}, fixtureUse, testInfo) => {
    const admin = createAdminClient();
    const runId = `${testInfo.parallelIndex}-${randomUUID()}`;
    const password = `${randomUUID()}-Aa1!`;
    const created: TestActor[] = [];

    try {
      const alice = await createActor(admin, "Alice", runId, password);
      created.push(alice);
      const bob = await createActor(admin, "Bob", runId, password);
      created.push(bob);
      const charlie = await createActor(admin, "Charlie", runId, password);
      created.push(charlie);

      await fixtureUse({ alice, bob, charlie });
    } finally {
      if (created.length > 0) {
        await deleteOwnedWorkspaces(admin, created);
        await deleteActorAvatars(admin, created);
      }

      for (const actor of created.toReversed()) {
        const { error } = await admin.auth.admin.deleteUser(actor.id);
        if (error) {
          throw new Error(`无法清理测试身份 ${actor.displayName}: ${error.message}`);
        }
      }
    }
  },

  loginAs: async ({}, fixtureUse) => {
    await fixtureUse(loginAsActor);
  },

  alicePage: async ({ page, actors, loginAs }, fixtureUse) => {
    await loginAs(page, actors.alice);
    await fixtureUse(page);
  },

  multiTenantWorkspaces: async ({ actors }, fixtureUse) => {
    const suffix = randomUUID().slice(0, 8);
    const alphaName = `Alpha ${suffix}`;
    const betaName = `Beta ${suffix}`;
    const aliceClient = await createAuthenticatedClient(actors.alice);
    const charlieClient = await createAuthenticatedClient(actors.charlie);

    const { data: alphaId, error: alphaError } = await aliceClient.rpc(
      "create_workspace",
      { name: alphaName },
    );
    if (alphaError || !alphaId) {
      throw new Error(`无法创建 Alpha 测试工作区: ${alphaError?.message ?? "未知错误"}`);
    }

    const { error: memberError } = await aliceClient
      .from("workspace_members")
      .insert({
        workspace_id: alphaId,
        user_id: actors.bob.id,
        role: "member",
        added_by: actors.alice.id,
      });
    if (memberError) {
      throw new Error(`无法添加 Bob 测试成员: ${memberError.message}`);
    }

    const { data: betaId, error: betaError } = await charlieClient.rpc(
      "create_workspace",
      { name: betaName },
    );
    if (betaError || !betaId) {
      throw new Error(`无法创建 Beta 测试工作区: ${betaError?.message ?? "未知错误"}`);
    }

    await fixtureUse({ alphaId, alphaName, betaId, betaName });
  },
});

export { expect };
