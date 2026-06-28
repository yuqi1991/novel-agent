import { expect, test } from "@playwright/test";
import { createStory } from "./helpers";

test("Reply Variants can be rerolled, selected, and persisted at the mutable tail", async ({ page }) => {
  const storyTitle = `Variant Story ${Date.now()}`;
  const playerMessage = "I ask the archivist what the sealed map means.";

  await createStory(page, storyTitle, "A story for mutable tail variants.");

  await expect(page.getByRole("heading", { name: storyTitle })).toBeVisible();

  const chat = page.getByRole("region", { name: "聊天窗口" });
  await chat.getByPlaceholder("输入玩家角色的对白或行动...").fill(playerMessage);
  await chat.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("回复 1 / 1")).toBeVisible();
  const firstVariantText = (await chat.locator(".chat-message.system p").last().innerText()).trim();

  await page.getByRole("button", { name: "重掷回复" }).click();

  await expect(page.getByText("回复 2 / 2")).toBeVisible();
  const secondVariantText = (await chat.locator(".chat-message.system p").last().innerText()).trim();
  expect(secondVariantText).not.toEqual(firstVariantText);

  await page.getByRole("button", { name: "1" }).click();

  await expect(page.getByText("回复 1 / 2")).toBeVisible();
  await expect(chat.getByText(firstVariantText)).toBeVisible();

  await page.reload();

  await expect(page.getByText("回复 1 / 2")).toBeVisible();
  await expect(chat.getByText(firstVariantText)).toBeVisible();
});
