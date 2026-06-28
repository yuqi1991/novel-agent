import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createStory, openPanel } from "./helpers";

const characterFixtureJson = fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/sillytavern-character.json"),
  "utf8"
);
const worldFixtureJson = fs.readFileSync(
  path.join(process.cwd(), "tests/fixtures/sillytavern-world.json"),
  "utf8"
);

test("Story Workspace imports SillyTavern character JSON", async ({ page }) => {
  const storyTitle = `SillyTavern Character ${Date.now()}`;

  await createStory(page, storyTitle, "A workspace for importing SillyTavern material.");

  await expect(page.getByRole("heading", { name: storyTitle })).toBeVisible();
  const drawer = await openPanel(page, "世界书");

  const importForm = drawer.getByRole("heading", { name: "导入角色卡" }).locator("..");
  await importForm.getByLabel("文件名").fill("mira-vale.json");
  await importForm.getByLabel("角色卡 JSON").fill(characterFixtureJson);
  await importForm.getByRole("button", { name: "导入角色" }).click();

  const characterProfiles = drawer.getByRole("region", { name: "角色列表" });
  await expect(characterProfiles.getByText("Mira Vale")).toBeVisible();
  await expect(characterProfiles.getByText("Archivist who remembers every drowned city.")).toBeVisible();
  await expect(characterProfiles.getByText("Careful, curious, and exacting.")).toBeVisible();
});

test("Story Workspace imports SillyTavern world JSON", async ({ page }) => {
  const storyTitle = `SillyTavern World ${Date.now()}`;

  await createStory(page, storyTitle, "A workspace for importing SillyTavern world info.");

  await expect(page.getByRole("heading", { name: storyTitle })).toBeVisible();
  const drawer = await openPanel(page, "世界书");

  const importForm = drawer.getByRole("heading", { name: "导入世界书" }).locator("..");
  await importForm.getByLabel("文件名").fill("bell-reef-world.json");
  await importForm.getByLabel("世界书 JSON").fill(worldFixtureJson);
  await importForm.getByRole("button", { name: "导入世界书" }).click();

  const worldEntries = drawer.getByRole("region", { name: "世界书条目" });
  await expect(worldEntries.getByText("The Bell Reef")).toBeVisible();
  await expect(worldEntries.getByText("A submerged district that rings during storms.")).toBeVisible();
  await expect(worldEntries.getByText("Oath Furnace")).toBeVisible();
  await expect(worldEntries.getByText("A legal chamber where vows are burned into iron.")).toBeVisible();
});
