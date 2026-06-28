import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import { characterProfiles, storySettings, worldEntries } from "@/db/schema";
import { newId } from "@/domain/ids";

const storyIdSchema = z.string().trim().min(1, "Story id is required");
const idSchema = z.string().trim().min(1, "Id is required");

export const characterProfileRoleSchema = z.enum(["player", "non_player", "unspecified"]);

export const createCharacterProfileInput = z.object({
  storyId: storyIdSchema,
  name: z.string().trim().min(1, "Character name is required").max(120),
  role: z.preprocess(
    (value) => (value === "" ? undefined : value),
    characterProfileRoleSchema.optional().default("unspecified")
  ),
  profileText: z.string().trim().max(10_000).optional().default("")
});

export const updateCharacterProfileInput = createCharacterProfileInput.extend({
  profileId: idSchema
});

export const deleteCharacterProfileInput = z.object({
  storyId: storyIdSchema,
  profileId: idSchema
});

export const worldEntryInclusionModeSchema = z.enum(["always", "triggered", "semantic", "disabled"]);

export const createWorldEntryInput = z.object({
  storyId: storyIdSchema,
  title: z.string().trim().min(1, "World entry title is required").max(160),
  body: z.string().trim().max(20_000).optional().default(""),
  inclusionMode: z.preprocess(
    (value) => (value === "" ? undefined : value),
    worldEntryInclusionModeSchema.optional().default("semantic")
  ),
  triggerConfig: z.unknown().optional(),
  tags: z.array(z.string().trim().min(1)).optional()
});

export const updateWorldEntryInput = createWorldEntryInput.extend({
  worldEntryId: idSchema
});

export const deleteWorldEntryInput = z.object({
  storyId: storyIdSchema,
  worldEntryId: idSchema
});

export const updatePlayerCharacterInput = z.object({
  storyId: storyIdSchema,
  playerCharacterProfileId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  characterProfileId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
});

export type CreateCharacterProfileInput = z.input<typeof createCharacterProfileInput>;
export type UpdateCharacterProfileInput = z.input<typeof updateCharacterProfileInput>;
export type DeleteCharacterProfileInput = z.input<typeof deleteCharacterProfileInput>;
export type CreateWorldEntryInput = z.input<typeof createWorldEntryInput>;
export type UpdateWorldEntryInput = z.input<typeof updateWorldEntryInput>;
export type DeleteWorldEntryInput = z.input<typeof deleteWorldEntryInput>;
export type UpdatePlayerCharacterInput = z.input<typeof updatePlayerCharacterInput>;

export async function listCharacterProfiles(storyId: string, database: Database = db) {
  const parsedStoryId = storyIdSchema.parse(storyId);

  return database
    .select()
    .from(characterProfiles)
    .where(eq(characterProfiles.storyId, parsedStoryId))
    .orderBy(asc(characterProfiles.createdAt), asc(characterProfiles.name));
}

export async function listStoryMaterial(storyId: string, database: Database = db) {
  const parsedStoryId = storyIdSchema.parse(storyId);
  const [profiles, entries, [settings]] = await Promise.all([
    listCharacterProfiles(parsedStoryId, database),
    listWorldEntries(parsedStoryId, database),
    database.select().from(storySettings).where(eq(storySettings.storyId, parsedStoryId)).limit(1)
  ]);

  return {
    characterProfiles: profiles,
    worldEntries: entries,
    storySettings: settings ?? null,
    settings: settings ?? null,
    playerCharacterProfileId: settings?.playerCharacterProfileId ?? null
  };
}

export async function createCharacterProfile(input: CreateCharacterProfileInput, database: Database = db) {
  const parsed = createCharacterProfileInput.parse(input);
  const id = newId("character");

  await database.insert(characterProfiles).values({
    id,
    storyId: parsed.storyId,
    name: parsed.name,
    role: parsed.role,
    profileText: parsed.profileText
  });

  const [profile] = await database.select().from(characterProfiles).where(eq(characterProfiles.id, id)).limit(1);
  if (!profile) {
    throw new Error("Character profile was not persisted");
  }
  return profile;
}

export async function updateCharacterProfile(input: UpdateCharacterProfileInput, database: Database = db) {
  const parsed = updateCharacterProfileInput.parse(input);

  await database
    .update(characterProfiles)
    .set({
      name: parsed.name,
      role: parsed.role,
      profileText: parsed.profileText,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(and(eq(characterProfiles.id, parsed.profileId), eq(characterProfiles.storyId, parsed.storyId)));

  const [profile] = await database
    .select()
    .from(characterProfiles)
    .where(and(eq(characterProfiles.id, parsed.profileId), eq(characterProfiles.storyId, parsed.storyId)))
    .limit(1);

  if (!profile) {
    throw new Error("Character profile was not found");
  }
  return profile;
}

export async function deleteCharacterProfile(input: DeleteCharacterProfileInput | string, database: Database = db) {
  if (typeof input === "string") {
    const profileId = idSchema.parse(input);
    await database.delete(characterProfiles).where(eq(characterProfiles.id, profileId));
    return;
  }

  const parsed = deleteCharacterProfileInput.parse(input);

  await database
    .delete(characterProfiles)
    .where(and(eq(characterProfiles.id, parsed.profileId), eq(characterProfiles.storyId, parsed.storyId)));
}

export async function listWorldEntries(storyId: string, database: Database = db) {
  const parsedStoryId = storyIdSchema.parse(storyId);

  return database
    .select()
    .from(worldEntries)
    .where(eq(worldEntries.storyId, parsedStoryId))
    .orderBy(asc(worldEntries.createdAt), asc(worldEntries.title));
}

export async function createWorldEntry(input: CreateWorldEntryInput, database: Database = db) {
  const parsed = createWorldEntryInput.parse(input);
  const id = newId("world");

  await database.insert(worldEntries).values({
    id,
    storyId: parsed.storyId,
    title: parsed.title,
    body: parsed.body,
    inclusionMode: parsed.inclusionMode,
    triggerConfigJson: parsed.triggerConfig === undefined ? "{}" : JSON.stringify(parsed.triggerConfig),
    tagsJson: parsed.tags === undefined ? "[]" : JSON.stringify(parsed.tags)
  });

  const [entry] = await database.select().from(worldEntries).where(eq(worldEntries.id, id)).limit(1);
  if (!entry) {
    throw new Error("World entry was not persisted");
  }
  return entry;
}

export async function updateWorldEntry(input: UpdateWorldEntryInput, database: Database = db) {
  const parsed = updateWorldEntryInput.parse(input);
  const [existingEntry] = await database
    .select()
    .from(worldEntries)
    .where(and(eq(worldEntries.id, parsed.worldEntryId), eq(worldEntries.storyId, parsed.storyId)))
    .limit(1);

  if (!existingEntry) {
    throw new Error("World entry was not found");
  }

  await database
    .update(worldEntries)
    .set({
      title: parsed.title,
      body: parsed.body,
      inclusionMode: parsed.inclusionMode,
      triggerConfigJson:
        parsed.triggerConfig === undefined ? existingEntry.triggerConfigJson : JSON.stringify(parsed.triggerConfig),
      tagsJson: parsed.tags === undefined ? existingEntry.tagsJson : JSON.stringify(parsed.tags),
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(and(eq(worldEntries.id, parsed.worldEntryId), eq(worldEntries.storyId, parsed.storyId)));

  const [entry] = await database
    .select()
    .from(worldEntries)
    .where(and(eq(worldEntries.id, parsed.worldEntryId), eq(worldEntries.storyId, parsed.storyId)))
    .limit(1);

  if (!entry) {
    throw new Error("World entry was not found");
  }
  return entry;
}

export async function deleteWorldEntry(input: DeleteWorldEntryInput | string, database: Database = db) {
  if (typeof input === "string") {
    const worldEntryId = idSchema.parse(input);
    await database.delete(worldEntries).where(eq(worldEntries.id, worldEntryId));
    return;
  }

  const parsed = deleteWorldEntryInput.parse(input);

  await database
    .delete(worldEntries)
    .where(and(eq(worldEntries.id, parsed.worldEntryId), eq(worldEntries.storyId, parsed.storyId)));
}

export async function updatePlayerCharacter(input: UpdatePlayerCharacterInput, database: Database = db) {
  const parsed = updatePlayerCharacterInput.parse(input);
  const playerCharacterProfileId = parsed.playerCharacterProfileId ?? parsed.characterProfileId;

  if (playerCharacterProfileId) {
    const [profile] = await database
      .select({ id: characterProfiles.id })
      .from(characterProfiles)
      .where(and(eq(characterProfiles.id, playerCharacterProfileId), eq(characterProfiles.storyId, parsed.storyId)))
      .limit(1);

    if (!profile) {
      throw new Error("Player character profile does not belong to this story");
    }
  }

  await database
    .insert(storySettings)
    .values({
      storyId: parsed.storyId,
      playerCharacterProfileId
    })
    .onConflictDoUpdate({
      target: storySettings.storyId,
      set: {
        playerCharacterProfileId,
        updatedAt: sql`CURRENT_TIMESTAMP`
      }
    });

  const [settings] = await database
    .select()
    .from(storySettings)
    .where(eq(storySettings.storyId, parsed.storyId))
    .limit(1);

  if (!settings) {
    throw new Error("Story settings were not persisted");
  }
  return settings;
}

export const setPlayerCharacter = updatePlayerCharacter;
