import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import { agentProfiles } from "@/db/schema";
import { newId } from "@/domain/ids";

const idSchema = z.string().trim().min(1, "Id is required");

export const createAgentProfileInput = z.object({
  name: z.string().trim().min(1, "Agent 名称不能为空").max(160),
  agentRole: z.string().trim().min(1, "Agent 角色不能为空").max(120),
  description: z.string().trim().max(2_000).optional().default(""),
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

export const updateAgentProfileInput = createAgentProfileInput.extend({
  profileId: idSchema
});

export const deleteAgentProfileInput = z.object({
  profileId: idSchema
});

export type CreateAgentProfileInput = z.input<typeof createAgentProfileInput>;
export type UpdateAgentProfileInput = z.input<typeof updateAgentProfileInput>;

export async function listAgentProfiles(database: Database = db) {
  return database
    .select()
    .from(agentProfiles)
    .orderBy(asc(agentProfiles.createdAt), asc(agentProfiles.name));
}

export async function createAgentProfile(input: CreateAgentProfileInput, database: Database = db) {
  const parsed = createAgentProfileInput.parse(input);
  assertJsonArray(parsed.skillSetJson, "Skill Set 必须是 JSON 数组");
  assertJsonArray(parsed.allowedToolsJson, "允许工具必须是 JSON 数组");
  if (parsed.modelOverrideJson) {
    assertJsonObject(parsed.modelOverrideJson, "模型覆盖必须是 JSON 对象");
  }

  const id = newId("profile");
  await database.insert(agentProfiles).values({
    id,
    name: parsed.name,
    agentRole: parsed.agentRole,
    description: parsed.description,
    instructions: parsed.instructions,
    skillSetJson: parsed.skillSetJson,
    modelOverrideJson: parsed.modelOverrideJson,
    allowedToolsJson: parsed.allowedToolsJson,
    timeoutMs: parsed.timeoutMs
  });

  const [profile] = await database.select().from(agentProfiles).where(eq(agentProfiles.id, id)).limit(1);
  if (!profile) {
    throw new Error("Agent Profile 没有成功保存");
  }
  return profile;
}

export async function updateAgentProfile(input: UpdateAgentProfileInput, database: Database = db) {
  const parsed = updateAgentProfileInput.parse(input);
  assertJsonArray(parsed.skillSetJson, "Skill Set 必须是 JSON 数组");
  assertJsonArray(parsed.allowedToolsJson, "允许工具必须是 JSON 数组");
  if (parsed.modelOverrideJson) {
    assertJsonObject(parsed.modelOverrideJson, "模型覆盖必须是 JSON 对象");
  }

  await database
    .update(agentProfiles)
    .set({
      name: parsed.name,
      agentRole: parsed.agentRole,
      description: parsed.description,
      instructions: parsed.instructions,
      skillSetJson: parsed.skillSetJson,
      modelOverrideJson: parsed.modelOverrideJson,
      allowedToolsJson: parsed.allowedToolsJson,
      timeoutMs: parsed.timeoutMs,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(agentProfiles.id, parsed.profileId));

  const [profile] = await database
    .select()
    .from(agentProfiles)
    .where(eq(agentProfiles.id, parsed.profileId))
    .limit(1);
  if (!profile) {
    throw new Error("Agent Profile 不存在");
  }
  return profile;
}

export async function deleteAgentProfile(input: { profileId: string }, database: Database = db) {
  const parsed = deleteAgentProfileInput.parse(input);
  await database.delete(agentProfiles).where(eq(agentProfiles.id, parsed.profileId));
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
