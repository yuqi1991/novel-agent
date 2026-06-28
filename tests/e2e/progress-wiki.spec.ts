import { expect, test } from "@playwright/test";
import { createStory, openPanel } from "./helpers";

test("Progress Wiki Editor creates, edits, and snapshots session memory", async ({ page }) => {
  const storyTitle = `Wiki Story ${Date.now()}`;

  await createStory(page, storyTitle, "A story for progress wiki editing.");

  await expect(page.getByRole("heading", { name: storyTitle })).toBeVisible();

  const wikiEditor = await openPanel(page, "记忆 Wiki");
  await expect(wikiEditor.getByRole("heading", { name: "记忆 Wiki" })).toBeVisible();

  const createForm = wikiEditor.getByRole("heading", { name: "创建记忆文档" }).locator("..");
  await createForm.getByLabel("标题").fill("Current Plot State");
  await createForm.getByLabel("内容").fill("The player found a copper key.");
  await createForm.getByRole("button", { name: "创建文档" }).click();

  const documents = wikiEditor.getByRole("region", { name: "记忆文档" });
  await expect(documents.getByLabel("标题")).toHaveValue("Current Plot State");
  await documents.getByLabel("内容").fill("The player hid the copper key under the stair.");
  await documents.getByRole("button", { name: "保存文档" }).click();

  await expect(documents.locator("textarea")).toHaveValue("The player hid the copper key under the stair.");

  const snapshots = wikiEditor.getByRole("region", { name: "记忆快照" });
  await snapshots.getByLabel("记忆边界楼层").fill("10");
  await snapshots.getByRole("button", { name: "创建快照" }).click();

  await expect(snapshots.getByText("边界 10")).toBeVisible();

  await page.reload();

  await expect(page.getByRole("region", { name: "记忆文档" }).getByLabel("标题")).toHaveValue("Current Plot State");
  await expect(page.getByRole("region", { name: "记忆快照" }).getByText("边界 10")).toBeVisible();
});
