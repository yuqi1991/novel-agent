import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import { agentAssignments, agentProfiles, orchestrationConfigurations } from "@/db/schema";
import { newId } from "@/domain/ids";

const idSchema = z.string().trim().min(1, "Id is required");

export const createOrchestrationConfigurationInput = z.object({
  name: z.string().trim().min(1, "Configuration name is required").max(160),
  description: z.string().trim().max(2_000).optional().default(""),
  modelDefaultsJson: z.string().trim().optional().default("{}")
});

export const deleteOrchestrationConfigurationInput = z.object({
  configurationId: idSchema
});

export const createAgentAssignmentInput = z.object({
  configurationId: idSchema,
  name: z.string().trim().min(1, "Agent name is required").max(160),
  agentRole: z.string().trim().min(1, "Agent role is required").max(120),
  instructions: z.string().trim().max(20_000).optional().default(""),
  skillSetJson: z.string().trim().optional().default("[]"),
  modelOverrideJson: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
  allowedToolsJson: z.string().trim().optional().default("[]"),
  timeoutMs: z.coerce.number().int().min(1_000).max(600_000).optional().default(60_000)
});

export const deleteAgentAssignmentInput = z.object({
  configurationId: idSchema,
  assignmentId: idSchema
});

export const createAgentAssignmentFromProfileInput = z.object({
  configurationId: idSchema,
  profileId: idSchema
});

export type CreateOrchestrationConfigurationInput = z.input<typeof createOrchestrationConfigurationInput>;
export type CreateAgentAssignmentInput = z.input<typeof createAgentAssignmentInput>;

export async function listOrchestrationConfigurations(database: Database = db) {
  const configurations = await database
    .select()
    .from(orchestrationConfigurations)
    .orderBy(asc(orchestrationConfigurations.createdAt), asc(orchestrationConfigurations.name));
  const assignments = await database
    .select()
    .from(agentAssignments)
    .orderBy(asc(agentAssignments.orderIndex), asc(agentAssignments.createdAt));

  return configurations.map((configuration) => ({
    ...configuration,
    assignments: assignments.filter(
      (assignment) => assignment.orchestrationConfigurationId === configuration.id
    )
  }));
}

export async function createOrchestrationConfiguration(
  input: CreateOrchestrationConfigurationInput,
  database: Database = db
) {
  const parsed = createOrchestrationConfigurationInput.parse(input);
  assertJsonObject(parsed.modelDefaultsJson, "Model defaults must be valid JSON");
  const id = newId("orch");

  await database.insert(orchestrationConfigurations).values({
    id,
    name: parsed.name,
    description: parsed.description,
    modelDefaultsJson: parsed.modelDefaultsJson
  });

  const [configuration] = await database
    .select()
    .from(orchestrationConfigurations)
    .where(eq(orchestrationConfigurations.id, id))
    .limit(1);
  if (!configuration) {
    throw new Error("Orchestration Configuration was not persisted");
  }
  return configuration;
}

export async function deleteOrchestrationConfiguration(input: { configurationId: string }, database: Database = db) {
  const parsed = deleteOrchestrationConfigurationInput.parse(input);
  await database
    .delete(orchestrationConfigurations)
    .where(eq(orchestrationConfigurations.id, parsed.configurationId));
}

export async function createAgentAssignment(input: CreateAgentAssignmentInput, database: Database = db) {
  const parsed = createAgentAssignmentInput.parse(input);
  assertJsonArray(parsed.skillSetJson, "Skill Set must be valid JSON array");
  assertJsonArray(parsed.allowedToolsJson, "Allowed tools must be valid JSON array");
  if (parsed.modelOverrideJson) {
    assertJsonObject(parsed.modelOverrideJson, "Model override must be valid JSON");
  }

  const orderIndex = await nextAssignmentOrderIndex(parsed.configurationId, database);
  const id = newId("agent");

  await database.insert(agentAssignments).values({
    id,
    orchestrationConfigurationId: parsed.configurationId,
    orderIndex,
    agentRole: parsed.agentRole,
    name: parsed.name,
    instructions: parsed.instructions,
    skillSetJson: parsed.skillSetJson,
    modelOverrideJson: parsed.modelOverrideJson,
    allowedToolsJson: parsed.allowedToolsJson,
    timeoutMs: parsed.timeoutMs
  });

  const [assignment] = await database.select().from(agentAssignments).where(eq(agentAssignments.id, id)).limit(1);
  if (!assignment) {
    throw new Error("Agent Assignment was not persisted");
  }
  return assignment;
}

export async function createAgentAssignmentFromProfile(
  input: z.input<typeof createAgentAssignmentFromProfileInput>,
  database: Database = db
) {
  const parsed = createAgentAssignmentFromProfileInput.parse(input);
  const [profile] = await database
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.id, parsed.profileId))
    .limit(1);
  if (!profile) {
    throw new Error("Agent Profile 不存在");
  }

  return createAgentAssignment(
    {
      configurationId: parsed.configurationId,
      name: profile.name,
      agentRole: profile.agentRole,
      instructions: profile.instructions,
      skillSetJson: profile.skillSetJson,
      modelOverrideJson: profile.modelOverrideJson ?? "",
      allowedToolsJson: profile.allowedToolsJson,
      timeoutMs: profile.timeoutMs
    },
    database
  );
}

export async function deleteAgentAssignment(
  input: { configurationId: string; assignmentId: string },
  database: Database = db
) {
  const parsed = deleteAgentAssignmentInput.parse(input);
  await database
    .delete(agentAssignments)
    .where(
      and(
        eq(agentAssignments.id, parsed.assignmentId),
        eq(agentAssignments.orchestrationConfigurationId, parsed.configurationId)
      )
    );
}

async function nextAssignmentOrderIndex(configurationId: string, database: Pick<Database, "select">) {
  const [row] = await database
    .select({ nextIndex: sql<number>`coalesce(max(${agentAssignments.orderIndex}), -1) + 1` })
    .from(agentAssignments)
    .where(eq(agentAssignments.orchestrationConfigurationId, configurationId));
  return row?.nextIndex ?? 0;
}

function assertJsonObject(value: string, message: string) {
  const parsed = parseJson(value, message);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(message);
  }
}

function assertJsonArray(value: string, message: string) {
  const parsed = parseJson(value, message);
  if (!Array.isArray(parsed)) {
    throw new Error(message);
  }
}

function parseJson(value: string, message: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(message);
  }
}
