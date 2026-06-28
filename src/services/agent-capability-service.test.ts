import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import { characterProfiles, storyMaterialProposals } from "@/db/schema";
import {
  assertCanMutateProgressWiki,
  assertSubagentReadOnlyOperation,
  createExternalToolConfiguration,
  createStoryMaterialProposal,
  resolveAgentCapabilities,
  runReadOnlySubagent
} from "./agent-capability-service";
import { createAgentAssignment, createOrchestrationConfiguration } from "./orchestration-config-service";
import { createStory } from "./story-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-capability-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("agent-capability-service", () => {
  it("resolves Skill Set, allowed Agent-Facing Tools, and enabled MCP configurations", async () => {
    const db = await createTestDatabase();
    const configuration = await createOrchestrationConfiguration({ name: "Research Team" }, db);
    const tool = await createExternalToolConfiguration(
      {
        name: "web-search",
        configJson: '{"command":"web-search-mcp","args":[]}'
      },
      db
    );
    const assignment = await createAgentAssignment(
      {
        configurationId: configuration.id,
        name: "Researcher",
        agentRole: "research",
        skillSetJson: '["subagent","progress_wiki"]',
        allowedToolsJson: '["spawn_subagent","web-search"]'
      },
      db
    );

    const capabilities = await resolveAgentCapabilities(assignment, db);

    expect(capabilities).toEqual(
      expect.objectContaining({
        skillSet: ["subagent", "progress_wiki"],
        allowedTools: ["spawn_subagent", "web-search"],
        canSpawnSubagents: true,
        canUseProgressWikiSkill: true,
        externalTools: [expect.objectContaining({ id: tool.id, name: "web-search" })]
      })
    );
  });

  it("lets main agents receive read-only Subagent Results and blocks subagent mutation", async () => {
    const results = await runReadOnlySubagent({
      assignmentName: "Plot Director",
      contextSummary: "2 recent items",
      capabilities: {
        skillSet: ["subagent"],
        allowedTools: ["spawn_subagent"],
        externalTools: [],
        canSpawnSubagents: true,
        canUseProgressWikiSkill: false
      }
    });

    expect(results).toEqual([
      expect.objectContaining({
        depth: 1,
        operation: "read_context",
        result: expect.stringContaining("2 recent items")
      })
    ]);
    expect(() => assertSubagentReadOnlyOperation("write_progress_wiki")).toThrow(
      "Subagents are read-only"
    );
  });

  it("requires the progress_wiki skill for Progress Wiki mutation", () => {
    expect(() => assertCanMutateProgressWiki({ canUseProgressWikiSkill: false })).toThrow(
      "Progress Wiki mutation requires the progress_wiki skill"
    );
    expect(() => assertCanMutateProgressWiki({ canUseProgressWikiSkill: true })).not.toThrow();
  });

  it("creates Story Material Proposals for review without changing shared Story Material", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Proposal Story" }, db);

    const proposal = await createStoryMaterialProposal(
      {
        storyId: story.id,
        proposalType: "create",
        targetEntityType: "character_profile",
        proposedChangeJson: '{"name":"Proposed NPC","profileText":"Not yet accepted."}'
      },
      db
    );

    const profiles = await db.select().from(characterProfiles);
    const proposals = await db.select().from(storyMaterialProposals);

    expect(proposal).toEqual(
      expect.objectContaining({
        storyId: story.id,
        status: "pending",
        targetEntityType: "character_profile"
      })
    );
    expect(profiles).toEqual([]);
    expect(proposals).toEqual([expect.objectContaining({ id: proposal.id, status: "pending" })]);
  });
});
