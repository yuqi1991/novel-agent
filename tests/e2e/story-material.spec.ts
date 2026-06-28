import { expect, test } from "@playwright/test";
import { createStory, openPanel } from "./helpers";

test("Story Workspace creates Character Profiles and World Entries", async ({ page }) => {
  const storyTitle = `Material Story ${Date.now()}`;

  await createStory(page, storyTitle, "A workspace for Story Material.");

  await expect(page.getByRole("heading", { name: storyTitle })).toBeVisible();
  const drawer = await openPanel(page, "故事资料 / 世界书");
  await expect(drawer.getByRole("form", { name: "故事资料" })).toBeVisible();
  await expect(drawer.getByRole("region", { name: "角色列表" })).toBeVisible();

  const characterForm = drawer.getByRole("heading", { name: "创建角色" }).locator("..");
  await characterForm.getByLabel("名称").fill("Mira Vale");
  await characterForm.getByLabel("类型").selectOption("player");
  await characterForm.getByLabel("人设").fill("Archivist who remembers every drowned city.");
  await characterForm.getByRole("button", { name: "创建角色" }).click();

  const characterProfiles = drawer.getByRole("region", { name: "角色列表" });
  await expect(characterProfiles.getByText("Mira Vale")).toBeVisible();
  await expect(characterProfiles.getByText("Archivist who remembers every drowned city.")).toBeVisible();

  await drawer.getByRole("button", { name: "设为玩家角色" }).click();
  await expect(drawer.getByRole("button", { name: "取消玩家角色" })).toBeVisible();

  const worldEntryForm = drawer.getByRole("heading", { name: "创建世界书条目" }).locator("..");
  await worldEntryForm.getByLabel("标题").fill("The Bell Reef");
  await worldEntryForm.getByLabel("内容").fill("A submerged district that rings during storms.");
  await worldEntryForm.getByLabel("加入方式").selectOption("always");
  await worldEntryForm.getByRole("button", { name: "创建条目" }).click();

  const worldEntries = drawer.getByRole("region", { name: "世界书条目" });
  await expect(worldEntries.getByText("The Bell Reef")).toBeVisible();
  await expect(worldEntries.getByText("A submerged district that rings during storms.")).toBeVisible();
  await expect(worldEntries.getByText("始终加入")).toBeVisible();
});
