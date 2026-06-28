import { expect, test } from "@playwright/test";
import { createStory, openPanel } from "./helpers";

test("Orchestration Builder creates a linear Agent Assignment", async ({ page }) => {
  const storyTitle = `Orchestration Story ${Date.now()}`;
  const runId = Date.now();
  const configurationName = `标准写作组 ${runId}`;
  const agentName = `剧情导演 ${runId}`;

  await createStory(page, storyTitle, "A story for configuring agents.");

  await expect(page.getByRole("heading", { name: storyTitle })).toBeVisible();

  const agentDrawer = await openPanel(page, "Agent 管理");
  const profileForm = agentDrawer.getByRole("heading", { name: "创建 Agent Profile" }).locator("..");
  await profileForm.getByLabel("名称").fill(agentName);
  await profileForm.getByLabel("角色").fill("plot_direction");
  await profileForm.getByLabel("指令").fill("Plan the next story beat.");
  await profileForm.getByRole("button", { name: "创建 Agent" }).click();
  await expect(agentDrawer.locator(`input[value="${agentName}"]`)).toBeVisible();

  const drawer = await openPanel(page, "Agent 编排");
  const configForm = drawer.getByRole("heading", { name: "创建编排" }).locator("..");
  await configForm.getByLabel("名称").fill(configurationName);
  await configForm.getByLabel("说明").fill("Plot direction followed by prose writing.");
  await configForm.getByRole("button", { name: "创建编排" }).click();

  const configurations = drawer.getByRole("region", { name: "Agent 编排列表" });
  await expect(configurations.getByText(configurationName)).toBeVisible();
  const configurationItem = configurations.getByRole("listitem").filter({ hasText: configurationName });

  const agentForm = configurationItem.getByRole("form", { name: `从 Agent Profile 添加到 ${configurationName}` });
  await agentForm.getByLabel("选择 Agent Profile").selectOption({ label: agentName });
  await agentForm.getByRole("button", { name: "加入 Workflow" }).click();

  await expect(configurationItem.getByText(`1. ${agentName}`)).toBeVisible();
  await expect(configurationItem.getByText("plot_direction · 60000ms")).toBeVisible();
});
