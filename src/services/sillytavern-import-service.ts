import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import { characterProfiles, importedAssets, worldEntries } from "@/db/schema";
import { newId } from "@/domain/ids";

const storyIdSchema = z.string().trim().min(1, "Story id is required");

const importSourceTypeSchema = z.enum(["character_card", "world_lorebook"]);

export const sillyTavernImportInput = z.object({
  storyId: storyIdSchema,
  sourceType: importSourceTypeSchema,
  jsonText: z.string().trim().min(1, "Import JSON is required"),
  originalFilename: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
  contentType: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : "application/json"))
});

export type SillyTavernImportInput = z.input<typeof sillyTavernImportInput>;

type JsonRecord = Record<string, unknown>;
type InclusionMode = "always" | "triggered" | "semantic" | "disabled";

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean);
  }
  const stringValue = asString(value);
  return stringValue ? [stringValue] : [];
}

export function parseSillyTavernJsonPayload(jsonText: string) {
  try {
    return z.unknown().parse(JSON.parse(jsonText));
  } catch {
    throw new Error("Import JSON must be valid JSON");
  }
}

function unwrapCharacterPayload(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  return data ?? root;
}

export function convertSillyTavernCharacterPayload(payload: unknown) {
  const character = unwrapCharacterPayload(payload);
  if (!character) {
    throw new Error("Character card JSON must be an object");
  }

  const name = asString(character.name) || "Imported Character";
  const fields = [
    ["Description", character.description],
    ["Personality", character.personality],
    ["Scenario", character.scenario],
    ["First message", character.first_mes],
    ["Example messages", character.mes_example]
  ];
  const profileText = fields
    .map(([label, value]) => {
      const text = asString(value);
      return text ? `${label}:\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  return {
    name,
    profileText,
    metadataJson: JSON.stringify({ importedFrom: "sillytavern_character_card" })
  };
}

export function convertSillyTavernCharacterWorldPayload(payload: unknown) {
  const character = unwrapCharacterPayload(payload);
  if (!character) {
    throw new Error("Character card JSON must be an object");
  }

  const books = [
    character.character_book,
    asRecord(character.extensions)?.character_book,
    asRecord(character.extensions)?.world_book,
    asRecord(character.extensions)?.lorebook
  ].filter(Boolean);

  const entries = books.flatMap((book) => {
    try {
      return convertSillyTavernWorldPayload(book);
    } catch {
      return [];
    }
  });

  return entries.filter(
    (entry, index, allEntries) =>
      allEntries.findIndex(
        (candidate) => candidate.title === entry.title && candidate.body === entry.body
      ) === index
  );
}

function unwrapWorldPayload(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  return data ?? root;
}

function collectRawWorldEntries(payload: unknown) {
  const world = unwrapWorldPayload(payload);
  if (!world) {
    throw new Error("World/lorebook JSON must be an object");
  }

  const rawEntries = world.entries;
  if (Array.isArray(rawEntries)) {
    return rawEntries;
  }
  const entryRecord = asRecord(rawEntries);
  if (entryRecord) {
    return Object.values(entryRecord);
  }
  return [world];
}

function hasTruthyFlag(entry: JsonRecord, names: string[]) {
  return names.some((name) => entry[name] === true || entry[name] === 1 || entry[name] === "true");
}

function hasDisabledFlag(entry: JsonRecord) {
  return hasTruthyFlag(entry, ["disable", "disabled"]) || entry.enabled === false;
}

function getInclusionMode(entry: JsonRecord, keys: string[]): InclusionMode {
  if (hasDisabledFlag(entry)) {
    return "disabled";
  }
  if (hasTruthyFlag(entry, ["always", "constant"])) {
    return "always";
  }
  if (keys.length > 0) {
    return "triggered";
  }
  return "semantic";
}

export function convertSillyTavernWorldPayload(payload: unknown) {
  const converted = collectRawWorldEntries(payload)
    .map(asRecord)
    .filter((entry): entry is JsonRecord => entry !== null)
    .map((entry, index) => {
      const keys = [...asStringArray(entry.key), ...asStringArray(entry.keys)].filter(
        (key, keyIndex, allKeys) => allKeys.indexOf(key) === keyIndex
      );
      const title =
        asString(entry.title) ||
        asString(entry.comment) ||
        keys[0] ||
        `Imported World Entry ${index + 1}`;
      const body = asString(entry.content) || asString(entry.body);

      return {
        title,
        body,
        inclusionMode: getInclusionMode(entry, keys),
        triggerConfigJson: JSON.stringify({ keys }),
        tagsJson: JSON.stringify([])
      };
    });

  if (converted.length === 0) {
    throw new Error("World/lorebook JSON did not contain any importable entries");
  }

  return converted;
}

export async function importSillyTavernJson(input: SillyTavernImportInput, database: Database = db) {
  const parsed = sillyTavernImportInput.parse(input);
  const payload = parseSillyTavernJsonPayload(parsed.jsonText);
  const assetId = newId("asset");
  const rawPayloadJson = JSON.stringify(payload);

  return database.transaction(async (tx) => {
    await tx.insert(importedAssets).values({
      id: assetId,
      storyId: parsed.storyId,
      sourceType: `sillytavern_${parsed.sourceType}`,
      originalFilename: parsed.originalFilename,
      contentType: parsed.contentType,
      rawPayloadJson
    });

    if (parsed.sourceType === "character_card") {
      const character = convertSillyTavernCharacterPayload(payload);
      const entries = convertSillyTavernCharacterWorldPayload(payload);
      const characterProfileId = newId("character");
      const worldEntryIds = entries.map(() => newId("world"));

      await tx.insert(characterProfiles).values({
        id: characterProfileId,
        storyId: parsed.storyId,
        importedAssetId: assetId,
        name: character.name,
        role: "unspecified",
        profileText: character.profileText,
        metadataJson: character.metadataJson
      });

      if (entries.length > 0) {
        await tx.insert(worldEntries).values(
          entries.map((entry, index) => ({
            id: worldEntryIds[index],
            storyId: parsed.storyId,
            importedAssetId: assetId,
            title: entry.title,
            body: entry.body,
            inclusionMode: entry.inclusionMode,
            triggerConfigJson: entry.triggerConfigJson,
            tagsJson: entry.tagsJson
          }))
        );
      }

      return {
        importedAssetId: assetId,
        characterProfileIds: [characterProfileId],
        worldEntryIds
      };
    }

    const entries = convertSillyTavernWorldPayload(payload);
    const worldEntryIds = entries.map(() => newId("world"));

    await tx.insert(worldEntries).values(
      entries.map((entry, index) => ({
        id: worldEntryIds[index],
        storyId: parsed.storyId,
        importedAssetId: assetId,
        title: entry.title,
        body: entry.body,
        inclusionMode: entry.inclusionMode,
        triggerConfigJson: entry.triggerConfigJson,
        tagsJson: entry.tagsJson
      }))
    );

    return {
      importedAssetId: assetId,
      characterProfileIds: [],
      worldEntryIds
    };
  });
}

export async function importSillyTavernCharacter(
  input: Omit<SillyTavernImportInput, "sourceType" | "jsonText"> & {
    jsonText?: string;
    payload?: unknown;
    rawPayloadJson?: string;
  },
  database: Database = db
) {
  return importSillyTavernJson(
    {
      ...input,
      sourceType: "character_card",
      jsonText: normalizeImportJson(input)
    },
    database
  );
}

export async function importSillyTavernWorld(
  input: Omit<SillyTavernImportInput, "sourceType" | "jsonText"> & {
    jsonText?: string;
    payload?: unknown;
    rawPayloadJson?: string;
  },
  database: Database = db
) {
  return importSillyTavernJson(
    {
      ...input,
      sourceType: "world_lorebook",
      jsonText: normalizeImportJson(input)
    },
    database
  );
}

function normalizeImportJson(input: { jsonText?: string; payload?: unknown; rawPayloadJson?: string }) {
  if (typeof input.jsonText === "string") {
    return input.jsonText;
  }
  if (typeof input.rawPayloadJson === "string") {
    return input.rawPayloadJson;
  }
  if (input.payload !== undefined) {
    return JSON.stringify(input.payload);
  }
  return "";
}
