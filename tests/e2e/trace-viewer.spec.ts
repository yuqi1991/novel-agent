import { expect, test } from "@playwright/test";
import { createStory, openPanel } from "./helpers";

test("Trace Viewer shows Workflow Trace details after a player message", async ({ page }) => {
  const storyTitle = `Trace Story ${Date.now()}`;

  await createStory(page, storyTitle, "A story for trace inspection.");

  const chat = page.getByRole("region", { name: "聊天窗口" });
  await chat.getByPlaceholder("输入玩家角色的对白或行动...").fill("I open the brass door.");
  await chat.getByRole("button", { name: "发送" }).click();

  const traceViewer = await openPanel(page, "运行记录");
  await expect(traceViewer.getByRole("heading", { name: "运行记录" })).toBeVisible();
  await expect(traceViewer.getByText("succeeded").first()).toBeVisible();
  await expect(traceViewer.getByText("Narrative Response").first()).toBeVisible();
  await traceViewer.getByText("输入 / 输出").click();
  await expect(traceViewer.getByText("I open the brass door")).toBeVisible();
});
