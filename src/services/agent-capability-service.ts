import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import {
  agentAssignments,
  externalToolConfigurations,
  storyMaterialProposals
} from "@/db/schema";
import { newId } from "@/domain/ids";

const idSchema = z.string().trim().min(1, "Id is required");

export const createExternalToolConfigurationInput = z.object({
  name: z.string().trim().min(1, "Tool configuration name is required").max(160),
  providerType: z.literal("mcp").optional().default("mcp"),
  configJson: z.string().trim().min(1).default("{}"),
  enabled: z.coerce.boolean().optional().default(true)
});

export const createStoryMaterialProposalInput = z.object({
  storyId: idSchema,
  sourceWorkflowTraceId: idSchema.optional().nullable(),
  proposalType: z.string().trim().min(1).max(80),
  targetEntityType: z.string().trim().min(1).max(80),
  targetEntityId: z.string().trim().optional().nullable(),
  proposedChangeJson: z.string().trim().min(1)
});

export type CreateExternalToolConfigurationInput = z.input<typeof createExternalToolConfigurationInput>;
export type CreateStoryMaterialProposalInput = z.input<typeof createStoryMaterialProposalInput>;

export type AgentCapabilities = {
  skillSet: string[];
  allowedTools: string[];
  externalTools: Array<typeof externalToolConfigurations.$inferSelect>;
  canUseProgressWikiSkill: boolean;
  canSpawnSubagents: boolean;
};

export async function listExternalToolConfigurations(database: Database = db) {
  return database
    .select()
    .from(externalToolConfigurations)
    .orderBy(asc(externalToolConfigurations.createdAt), asc(externalToolConfigurations.name));
}

export async function createExternalToolConfiguration(
  input: CreateExternalToolConfigurationInput,
  database: Database = db
) {
  const parsed = createExternalToolConfigurationInput.parse(input);
  assertJsonObject(parsed.configJson, "MCP config must be valid JSON object");

  const id = newId("tool");
  await database.insert(externalToolConfigurations).values({
    id,
    name: parsed.name,
    providerType: parsed.providerType,
    configJson: parsed.configJson,
    enabled: parsed.enabled
  });

  const [configuration] = await database
    .select()
    .from(externalToolConfigurations)
    .where(eq(externalToolConfigurations.id, id))
    .limit(1);
  if (!configuration) {
    throw new Error("External Tool Configuration was not persisted");
  }
  return configuration;
}

export async function resolveAgentCapabilities(
  assignment: typeof agentAssignments.$inferSelect,
  database: Pick<Database, "select"> = db
): Promise<AgentCapabilities> {
  const skillSet = parseJsonArray(assignment.skillSetJson);
  const allowedTools = parseJsonArray(assignment.allowedToolsJson);
  const externalTools = await database
    .select()
    .from(externalToolConfigurations)
    .where(eq(externalToolConfigurations.enabled, true));

  return {
    skillSet,
    allowedTools,
    externalTools: externalTools.filter((tool) => allowedTools.includes(tool.name) || allowedTools.includes(tool.id)),
    canUseProgressWikiSkill: skillSet.includes("progress_wiki"),
    canSpawnSubagents: skillSet.includes("subagent") || allowedTools.includes("spawn_subagent")
  };
}

export function assertSubagentReadOnlyOperation(operation: string) {
  if (operation !== "read_context") {
    throw new Error("Subagents are read-only and cannot mutate persistent state");
  }
}

export function assertCanMutateProgressWiki(capabilities: Pick<AgentCapabilities, "canUseProgressWikiSkill">) {
  if (!capabilities.canUseProgressWikiSkill) {
    throw new Error("Progress Wiki mutation requires the progress_wiki skill");
  }
}

export async function runReadOnlySubagent(input: {
  assignmentName: string;
  contextSummary: string;
  capabilities: AgentCapabilities;
}) {
  if (!input.capabilities.canSpawnSubagents) {
    return [];
  }

  assertSubagentReadOnlyOperation("read_context");
  return [
    {
      name: `${input.assignmentName} helper`,
      depth: 1,
      operation: "read_context",
      result: `Read-only subagent reviewed ${input.contextSummary}.`
    }
  ];
}

export async function createStoryMaterialProposal(
  input: CreateStoryMaterialProposalInput,
  database: Database = db
) {
  const parsed = createStoryMaterialProposalInput.parse(input);
  assertJsonObject(parsed.proposedChangeJson, "Proposed change must be valid JSON object");

  const id = newId("proposal");
  await database.insert(storyMaterialProposals).values({
    id,
    storyId: parsed.storyId,
    sourceWorkflowTraceId: parsed.sourceWorkflowTraceId ?? null,
    proposalType: parsed.proposalType,
    targetEntityType: parsed.targetEntityType,
    targetEntityId: parsed.targetEntityId || null,
    proposedChangeJson: parsed.proposedChangeJson
  });

  const [proposal] = await database
    .select()
    .from(storyMaterialProposals)
    .where(eq(storyMaterialProposals.id, id))
    .limit(1);
  if (!proposal) {
    throw new Error("Story Material Proposal was not persisted");
  }
  return proposal;
}

export async function reviewStoryMaterialProposal(
  input: { proposalId: string; status: "accepted" | "rejected" },
  database: Database = db
) {
  const proposalId = idSchema.parse(input.proposalId);

  await database
    .update(storyMaterialProposals)
    .set({
      status: input.status,
      reviewedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(storyMaterialProposals.id, proposalId));

  const [proposal] = await database
    .select()
    .from(storyMaterialProposals)
    .where(eq(storyMaterialProposals.id, proposalId))
    .limit(1);
  if (!proposal) {
    throw new Error("Story Material Proposal was not found");
  }
  return proposal;
}

function parseJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function assertJsonObject(value: string, message: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(message);
    }
  } catch {
    throw new Error(message);
  }
}
