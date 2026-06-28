import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import {
  createAgentAssignment,
  createOrchestrationConfiguration,
  deleteAgentAssignment,
  listOrchestrationConfigurations
} from "./orchestration-config-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-orchestration-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("orchestration-config-service", () => {
  it("creates a reusable configuration and ordered Agent Assignments", async () => {
    const db = await createTestDatabase();
    const configuration = await createOrchestrationConfiguration(
      {
        name: "Standard Writing Team",
        description: "Plot then prose.",
        modelDefaultsJson: '{"provider":"local-stub","model":"deterministic"}'
      },
      db
    );

    const first = await createAgentAssignment(
      {
        configurationId: configuration.id,
        name: "Plot Director",
        agentRole: "plot_direction",
        instructions: "Plan the next beat.",
        skillSetJson: '["plot"]',
        allowedToolsJson: "[]",
        timeoutMs: 45000
      },
      db
    );
    const second = await createAgentAssignment(
      {
        configurationId: configuration.id,
        name: "Prose Writer",
        agentRole: "prose_writer",
        instructions: "Write the final response.",
        skillSetJson: '["prose"]',
        allowedToolsJson: "[]",
        timeoutMs: 60000
      },
      db
    );

    const configurations = await listOrchestrationConfigurations(db);

    expect(configurations).toEqual([
      expect.objectContaining({
        id: configuration.id,
        name: "Standard Writing Team",
        assignments: [
          expect.objectContaining({ id: first.id, orderIndex: 0, name: "Plot Director" }),
          expect.objectContaining({ id: second.id, orderIndex: 1, name: "Prose Writer" })
        ]
      })
    ]);
  });

  it("removes Agent Assignments without deleting the configuration", async () => {
    const db = await createTestDatabase();
    const configuration = await createOrchestrationConfiguration({ name: "Memory Team" }, db);
    const assignment = await createAgentAssignment(
      {
        configurationId: configuration.id,
        name: "Memory Curator",
        agentRole: "memory_curation"
      },
      db
    );

    await deleteAgentAssignment({ configurationId: configuration.id, assignmentId: assignment.id }, db);

    const configurations = await listOrchestrationConfigurations(db);
    expect(configurations).toEqual([
      expect.objectContaining({ id: configuration.id, assignments: [] })
    ]);
  });
});
