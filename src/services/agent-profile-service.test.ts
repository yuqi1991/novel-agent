import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import { createAgentProfile, listAgentProfiles, updateAgentProfile } from "./agent-profile-service";
import {
  createAgentAssignmentFromProfile,
  createOrchestrationConfiguration,
  listOrchestrationConfigurations
} from "./orchestration-config-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-profile-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("agent-profile-service", () => {
  it("creates and updates reusable Agent Profiles", async () => {
    const db = await createTestDatabase();
    const profile = await createAgentProfile(
      {
        name: "剧情导演",
        agentRole: "plot_director",
        instructions: "规划下一幕。",
        skillSetJson: '["plot"]',
        allowedToolsJson: '["spawn_subagent"]',
        timeoutMs: 45000
      },
      db
    );

    await updateAgentProfile(
      {
        profileId: profile.id,
        name: "剧情导演 v2",
        agentRole: "plot_director",
        instructions: "规划下一幕并检查节奏。",
        skillSetJson: '["plot","subagent"]',
        allowedToolsJson: '["spawn_subagent"]',
        timeoutMs: 60000
      },
      db
    );

    const profiles = await listAgentProfiles(db);
    expect(profiles).toEqual([
      expect.objectContaining({
        id: profile.id,
        name: "剧情导演 v2",
        skillSetJson: '["plot","subagent"]',
        timeoutMs: 60000
      })
    ]);
  });

  it("copies an Agent Profile into an Orchestration Assignment snapshot", async () => {
    const db = await createTestDatabase();
    const configuration = await createOrchestrationConfiguration({ name: "标准写作组" }, db);
    const profile = await createAgentProfile(
      {
        name: "润色 Agent",
        agentRole: "prose_editor",
        instructions: "润色最终正文。",
        skillSetJson: '["prose"]',
        allowedToolsJson: "[]",
        timeoutMs: 50000
      },
      db
    );

    const assignment = await createAgentAssignmentFromProfile(
      { configurationId: configuration.id, profileId: profile.id },
      db
    );
    await updateAgentProfile(
      {
        profileId: profile.id,
        name: "润色 Agent 已修改",
        agentRole: "prose_editor",
        instructions: "新的模板说明。",
        skillSetJson: '["changed"]',
        allowedToolsJson: "[]",
        timeoutMs: 60000
      },
      db
    );

    const configurations = await listOrchestrationConfigurations(db);
    expect(configurations[0]?.assignments).toEqual([
      expect.objectContaining({
        id: assignment.id,
        name: "润色 Agent",
        instructions: "润色最终正文。",
        skillSetJson: '["prose"]',
        timeoutMs: 50000
      })
    ]);
  });
});
