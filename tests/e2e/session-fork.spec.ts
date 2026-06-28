import { expect, test } from "@playwright/test";
import { createStory } from "./helpers";

test("Session Fork copies only the selected transcript prefix into a new Play Session", async ({ page }) => {
  const storyTitle = `Fork Story ${Date.now()}`;
  const firstMessage = "I unlock the archive door.";
  const secondMessage = "I read the forbidden ledger.";

  await createStory(page, storyTitle, "A story for session forks.");

  await expect(page.getByRole("heading", { name: storyTitle })).toBeVisible();

  const chat = page.getByRole("region", { name: "聊天窗口" });
  await chat.getByPlaceholder("输入玩家角色的对白或行动...").fill(firstMessage);
  await chat.getByRole("button", { name: "发送" }).click();
  await chat.getByPlaceholder("输入玩家角色的对白或行动...").fill(secondMessage);
  await chat.getByRole("button", { name: "发送" }).click();

  await expect(chat.getByText(firstMessage, { exact: true })).toBeVisible();
  await expect(chat.getByText(secondMessage, { exact: true })).toBeVisible();

  const firstResponseItem = chat
    .locator(".chat-message")
    .filter({ hasText: "Narrative Response" })
    .first();
  await firstResponseItem.getByRole("button", { name: "分叉" }).click();

  const forkLink = page.getByRole("link", { name: /从第 2 楼分叉/ });
  await expect(forkLink).toBeVisible();
  await forkLink.click();

  await expect(page.getByRole("link", { name: "从第 2 楼分叉" })).toBeVisible();
  await expect(chat.getByText(firstMessage, { exact: true })).toBeVisible();
  await expect(chat.getByText(secondMessage, { exact: true })).not.toBeVisible();
  await expect(chat.locator(".chat-message")).toHaveCount(2);
});
