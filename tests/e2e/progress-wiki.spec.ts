import { expect, test } from "@playwright/test";
import { createStory, openPanel } from "./helpers";

test("Progress Wiki Editor creates, edits, and snapshots session memory", async ({ page }) => {
  const storyTitle = `Wiki Story ${Date.now()}`;

  await createStory(page, storyTitle, "A story for progress wiki editing.");

  await expect(page.getByRole("heading", { name: storyTitle })).toBeVisible();

  const saveManager = await openPanel(page, "存档管理");
  await expect(saveManager.getByRole("heading", { name: "存档管理" })).toBeVisible();
  await expect(saveManager.getByRole("region", { name: "存档聊天记录" })).toBeVisible();

  const wikiEditor = saveManager.getByRole("region", { name: "记忆 Wiki" });
  const createForm = wikiEditor.getByRole("button", { name: "创建文件" }).locator("..");
  await createForm.getByLabel("路径 / 文件名").fill("剧情/Current Plot State.md");
  await createForm.getByLabel("内容").fill("The player found a copper key.");
  await createForm.getByRole("button", { name: "创建文件" }).click();

  const browser = page.getByRole("navigation", { name: "Wiki 文件浏览器" });
  await expect(browser.getByText("剧情")).toBeVisible();
  await expect(browser.getByRole("link", { name: "Current Plot State.md" })).toBeVisible();

  const editor = page.getByLabel("Wiki 文件编辑器");
  await expect(editor.getByLabel("路径 / 文件名")).toHaveValue("剧情/Current Plot State.md");
  await editor.getByLabel("内容").fill("The player hid the copper key under the stair.");
  await editor.getByRole("button", { name: "保存文件" }).click();

  await expect(editor.locator("textarea")).toHaveValue("The player hid the copper key under the stair.");

  const snapshots = saveManager.getByRole("region", { name: "记忆快照" });
  await snapshots.getByLabel("记忆边界楼层").fill("10");
  await snapshots.getByRole("button", { name: "创建快照" }).click();

  await expect(snapshots.getByText("边界 10")).toBeVisible();

  await page.reload();

  await expect(page.getByLabel("Wiki 文件编辑器").getByLabel("路径 / 文件名")).toHaveValue("剧情/Current Plot State.md");
  await expect(page.getByRole("region", { name: "记忆快照" }).getByText("边界 10")).toBeVisible();
});
