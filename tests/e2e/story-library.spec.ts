import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const characterFixtureJson = fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/sillytavern-character.json"),
  "utf8"
);

test("Story Library renders the MVP app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "故事库" }).first()).toBeVisible();
  await page.getByRole("button", { name: "新建故事" }).click();
  await expect(page.getByRole("form", { name: "创建故事" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存创建并进入故事" })).toBeVisible();
});

test("Story Library pre-fills story creation from pasted SillyTavern character JSON", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "导入 SillyTavern" }).click();
  const importForm = page.getByRole("form", { name: "解析 SillyTavern JSON" });
  await importForm.getByLabel("导入类型").selectOption("character_card");
  await importForm.getByLabel("文件名").fill("mira-vale.json");
  await importForm.getByLabel("SillyTavern JSON").fill(characterFixtureJson);
  await importForm.getByRole("button", { name: "解析并预填" }).click();

  const createForm = page.getByRole("form", { name: "创建故事" });
  await expect(createForm.getByLabel("故事 / 角色名")).toHaveValue("Mira Vale");
  await expect(createForm.getByText("1 角色")).toBeVisible();

  await createForm.getByRole("button", { name: "保存创建并进入故事" }).click();

  await expect(page.getByLabel("聊天窗口").getByRole("heading", { name: "Mira Vale" })).toBeVisible();
  const drawer = await page.getByRole("link", { name: "故事资料 / 世界书" });
  await drawer.click();
  await expect(page.getByRole("complementary", { name: "故事资料 / 世界书" }).getByText("Mira Vale")).toBeVisible();
});
