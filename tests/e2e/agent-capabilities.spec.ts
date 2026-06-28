import { expect, test } from "@playwright/test";
import { createStory, openPanel } from "./helpers";

test("Agent capabilities expose user-provided MCP configuration in the Orchestration Builder", async ({ page }) => {
  const runId = Date.now();
  const storyTitle = `Capability Story ${runId}`;

  await createStory(page, storyTitle, "A story for agent capabilities.");

  await expect(page.getByRole("heading", { name: storyTitle })).toBeVisible();

  const drawer = await openPanel(page, "Agent 编排");
  const tools = drawer.getByRole("region", { name: "外部工具配置" });
  await tools.getByLabel("名称").fill(`web-search-${runId}`);
  await tools.getByLabel("MCP Config JSON").fill('{"command":"web-search-mcp","args":[]}');
  await tools.getByRole("button", { name: "添加 MCP 配置" }).click();
  const toolItem = tools.getByRole("listitem").filter({ hasText: `web-search-${runId}` });
  await expect(toolItem.getByText(`web-search-${runId}`)).toBeVisible();
  await expect(toolItem.getByText("mcp · 启用")).toBeVisible();
});
