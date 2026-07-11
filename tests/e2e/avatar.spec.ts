import {
  createAuthenticatedClient,
  expect,
  test,
} from "./fixtures/auth";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1EAAAAASUVORK5CYII=",
  "base64",
);
const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=",
  "base64",
);

test("updates the public avatar and display name from settings", async ({
  alicePage,
  actors,
}) => {
  await alicePage.goto("/app/settings");
  await alicePage.getByLabel("头像文件").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: png,
  });

  await expect(alicePage.getByText("头像已更新", { exact: true })).toBeVisible();
  const avatar = alicePage.getByRole("img", { name: "Alice的头像" }).first();
  await expect(avatar).toBeVisible();
  await expect
    .poll(() => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);

  await alicePage.getByLabel("昵称").fill("Alice Avatar");
  await alicePage.getByRole("button", { name: "保存昵称" }).click();
  await expect(alicePage.getByText("昵称已保存")).toBeVisible();

  const client = await createAuthenticatedClient(actors.alice);
  const { data, error } = await client
    .from("profiles")
    .select("display_name, avatar_path")
    .eq("id", actors.alice.id)
    .single();
  expect(error).toBeNull();
  expect(data).toEqual({
    display_name: "Alice Avatar",
    avatar_path: `${actors.alice.id}/avatar.png`,
  });
  const { data: publicData } = client.storage
    .from("avatars")
    .getPublicUrl(data!.avatar_path!);
  const response = await alicePage.request.get(publicData.publicUrl);
  expect(response.ok()).toBe(true);
});

test("upserts the same path and removes an old extension after profile switch", async ({
  alicePage,
  actors,
}) => {
  await alicePage.goto("/app/settings");
  const input = alicePage.getByLabel("头像文件");

  await input.setInputFiles({ name: "first.png", mimeType: "image/png", buffer: png });
  await expect(alicePage.getByText("头像已更新", { exact: true })).toBeVisible();
  await input.setInputFiles({ name: "second.PNG", mimeType: "image/png", buffer: png });
  await expect(alicePage.getByText("头像已更新", { exact: true })).toBeVisible();
  await input.setInputFiles({ name: "avatar.jpeg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(alicePage.getByText("头像已更新", { exact: true })).toBeVisible();

  const client = await createAuthenticatedClient(actors.alice);
  const { data: profile } = await client
    .from("profiles")
    .select("avatar_path")
    .eq("id", actors.alice.id)
    .single();
  expect(profile?.avatar_path).toBe(`${actors.alice.id}/avatar.jpg`);

  const { data: objects, error } = await client.storage.from("avatars").list(actors.alice.id);
  expect(error).toBeNull();
  expect(objects?.map((object) => object.name)).toEqual(["avatar.jpg"]);
});

test("blocks invalid files before upload", async ({ alicePage }) => {
  await alicePage.goto("/app/settings");
  const input = alicePage.getByLabel("头像文件");

  await input.setInputFiles({
    name: "avatar.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("gif"),
  });
  await expect(alicePage.getByText("请选择 JPEG、PNG 或 WebP 图片")).toBeVisible();

  await input.setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await expect(alicePage.getByText("头像不能超过 2 MB")).toBeVisible();
});

test("prevents Bob from overwriting or deleting Alice avatar path", async ({ actors }) => {
  const aliceClient = await createAuthenticatedClient(actors.alice);
  const bobClient = await createAuthenticatedClient(actors.bob);
  const path = `${actors.alice.id}/avatar.png`;

  const { error: aliceUploadError } = await aliceClient.storage
    .from("avatars")
    .upload(path, png, { contentType: "image/png", upsert: true });
  expect(aliceUploadError).toBeNull();

  const { error: bobUploadError } = await bobClient.storage
    .from("avatars")
    .upload(path, png, { contentType: "image/png", upsert: true });
  expect(bobUploadError).not.toBeNull();

  await bobClient.storage.from("avatars").remove([path]);

  const { data: publicData } = aliceClient.storage.from("avatars").getPublicUrl(path);
  const response = await fetch(publicData.publicUrl);
  expect(response.ok).toBe(true);
});
