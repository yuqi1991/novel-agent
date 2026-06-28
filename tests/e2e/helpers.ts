import type { Page } from "@playwright/test";

export async function createStory(page: Page, title: string, description = "测试故事") {
  await page.goto("/");
  const createForm = page.getByRole("form", { name: "创建故事" });
  await createForm.getByLabel("标题").fill(title);
  await createForm.getByLabel("简介").fill(description);
  await createForm.getByRole("button", { name: "创建并进入故事" }).click();
}

export async function openPanel(page: Page, name: string) {
  await page.getByRole("link", { name }).click();
  return page.getByRole("complementary", { name });
}
