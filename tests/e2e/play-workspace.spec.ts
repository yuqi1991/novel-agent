import { expect, test } from "@playwright/test";
import { createStory } from "./helpers";

test("Play Workspace creates a session, sends one message, and persists the Narrative Response", async ({
  page
}) => {
  const storyTitle = `Play Story ${Date.now()}`;
  const playerMessage = "I knock twice on the observatory door.";

  await createStory(page, storyTitle, "A story for first-turn play.");

  await expect(page.getByRole("heading", { name: storyTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: "默认存档" })).toBeVisible();

  const chat = page.getByRole("region", { name: "聊天窗口" });
  await chat.getByPlaceholder("输入玩家角色的对白或行动...").fill(playerMessage);
  await chat.getByRole("button", { name: "发送" }).click();

  await expect(chat.getByText(playerMessage, { exact: true })).toBeVisible();
  await expect(chat.getByText("Narrative Response")).toBeVisible();

  const responseText = (await chat.getByText("Narrative Response").last().innerText()).trim();
  expect(responseText.length).toBeGreaterThan(0);

  await page.reload();

  await expect(chat.getByText(playerMessage, { exact: true })).toBeVisible();
  await expect(chat.getByText(responseText)).toBeVisible();
});
