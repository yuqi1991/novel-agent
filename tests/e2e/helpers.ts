import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function createStory(page: Page, title: string, description = "测试故事") {
  await page.goto("/");
  await page.getByRole("button", { name: "新建故事" }).click();
  const createForm = page.getByRole("form", { name: "创建故事" });
  await createForm.getByLabel("故事 / 角色名").fill(title);
  await createForm.getByLabel("故事简介").fill(description);
  await Promise.all([
    page.waitForURL(/\/stories\/[^/?#]+/),
    createForm.getByRole("button", { name: "保存创建并进入故事" }).click()
  ]);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

export async function openPanel(page: Page, name: string) {
  await page.getByRole("link", { name }).click();
  return page.getByRole("complementary", { name });
}
