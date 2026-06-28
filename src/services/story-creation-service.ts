import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import {
  characterProfiles,
  importedAssets,
  stories,
  storySettings,
  worldEntries
} from "@/db/schema";
import { newId } from "@/domain/ids";
import {
  convertSillyTavernCharacterPayload,
  convertSillyTavernCharacterWorldPayload,
  convertSillyTavernWorldPayload,
  parseSillyTavernJsonPayload
} from "./sillytavern-import-service";

const importedAssetInput = z.object({
  sourceType: z.enum(["sillytavern_character_card", "sillytavern_world_lorebook"]),
  originalFilename: z.string().trim().optional().default(""),
  contentType: z.string().trim().optional().default("application/json"),
  rawPayloadJson: z.string().trim().min(1)
});

const characterDraftInput = z.object({
  name: z.string().trim().min(1),
  role: z.enum(["player", "non_player", "unspecified"]).optional().default("unspecified"),
  profileText: z.string().optional().default(""),
  metadataJson: z.string().optional().default("{}"),
  importedAssetIndex: z.coerce.number().int().min(0).optional()
});

const worldEntryDraftInput = z.object({
  title: z.string().trim().min(1),
  body: z.string().optional().default(""),
  inclusionMode: z.enum(["always", "triggered", "semantic", "disabled"]).optional().default("semantic"),
  triggerConfigJson: z.string().optional().default("{}"),
  tagsJson: z.string().optional().default("[]"),
  importedAssetIndex: z.coerce.number().int().min(0).optional()
});

export const createStoryFromDraftInput = z.object({
  title: z.string().trim().min(1, "故事标题不能为空").max(120),
  description: z.string().trim().max(2_000).optional().default(""),
  importedAssetsJson: z.string().trim().optional().default("[]"),
  characterProfilesJson: z.string().trim().optional().default("[]"),
  worldEntriesJson: z.string().trim().optional().default("[]")
});

export type CreateStoryFromDraftInput = z.input<typeof createStoryFromDraftInput>;

export function parseSillyTavernStoryDraft(input: {
  sourceType: "character_card" | "world_lorebook";
  jsonText: string;
  originalFilename?: string;
}) {
  const payload = parseSillyTavernJsonPayload(input.jsonText);
  const rawPayloadJson = JSON.stringify(payload);
  const importedAsset = {
    sourceType:
      input.sourceType === "character_card"
        ? "sillytavern_character_card"
        : "sillytavern_world_lorebook",
    originalFilename: input.originalFilename ?? "",
    contentType: "application/json",
    rawPayloadJson
  };

  if (input.sourceType === "character_card") {
    const character = convertSillyTavernCharacterPayload(payload);
    const entries = convertSillyTavernCharacterWorldPayload(payload);
    return {
      title: character.name,
      description: "",
      importedAssets: [importedAsset],
      characterProfiles: [
        {
          name: character.name,
          role: "unspecified",
          profileText: character.profileText,
          metadataJson: character.metadataJson,
          importedAssetIndex: 0
        }
      ],
      worldEntries: entries.map((entry) => ({
        ...entry,
        importedAssetIndex: 0
      }))
    };
  }

  const entries = convertSillyTavernWorldPayload(payload);
  return {
    title: input.originalFilename?.replace(/\.json$/i, "") || "导入的故事",
    description: "",
    importedAssets: [importedAsset],
    characterProfiles: [],
    worldEntries: entries.map((entry) => ({
      ...entry,
      importedAssetIndex: 0
    }))
  };
}

export async function createStoryFromDraft(input: CreateStoryFromDraftInput, database: Database = db) {
  const parsed = createStoryFromDraftInput.parse(input);
  const importedAssetDrafts = z.array(importedAssetInput).parse(parseJson(parsed.importedAssetsJson, []));
  const characterDrafts = z.array(characterDraftInput).parse(parseJson(parsed.characterProfilesJson, []));
  const worldEntryDrafts = z.array(worldEntryDraftInput).parse(parseJson(parsed.worldEntriesJson, []));
  const storyId = newId("story");

  await database.transaction(async (tx) => {
    await tx.insert(stories).values({
      id: storyId,
      title: parsed.title,
      description: parsed.description
    });
    await tx.insert(storySettings).values({ storyId });

    const importedAssetIds = importedAssetDrafts.map(() => newId("asset"));
    if (importedAssetDrafts.length > 0) {
      await tx.insert(importedAssets).values(
        importedAssetDrafts.map((asset, index) => ({
          id: importedAssetIds[index],
          storyId,
          sourceType: asset.sourceType,
          originalFilename: asset.originalFilename || null,
          contentType: asset.contentType,
          rawPayloadJson: asset.rawPayloadJson
        }))
      );
    }

    if (characterDrafts.length > 0) {
      await tx.insert(characterProfiles).values(
        characterDrafts.map((character) => ({
          id: newId("character"),
          storyId,
          importedAssetId:
            character.importedAssetIndex === undefined
              ? null
              : importedAssetIds[character.importedAssetIndex] ?? null,
          name: character.name,
          role: character.role,
          profileText: character.profileText,
          metadataJson: normalizeJson(character.metadataJson, "{}")
        }))
      );
    }

    if (worldEntryDrafts.length > 0) {
      await tx.insert(worldEntries).values(
        worldEntryDrafts.map((entry) => ({
          id: newId("world"),
          storyId,
          importedAssetId:
            entry.importedAssetIndex === undefined
              ? null
              : importedAssetIds[entry.importedAssetIndex] ?? null,
          title: entry.title,
          body: entry.body,
          inclusionMode: entry.inclusionMode,
          triggerConfigJson: normalizeJson(entry.triggerConfigJson, "{}"),
          tagsJson: normalizeJson(entry.tagsJson, "[]")
        }))
      );
    }
  });

  const [story] = await database.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  if (!story) {
    throw new Error("故事没有成功保存");
  }
  return story;
}

function parseJson(value: string, fallback: unknown) {
  if (!value.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}

function normalizeJson(value: string, fallback: string) {
  try {
    JSON.parse(value);
    return value;
  } catch {
    return fallback;
  }
}
