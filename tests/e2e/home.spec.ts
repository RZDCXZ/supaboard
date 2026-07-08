import { expect, test } from "@playwright/test";

test("根路由进入受保护应用入口", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("SupaBoard");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
  await expect(page.getByRole("heading", { name: "登录 SupaBoard" })).toBeVisible();
});
