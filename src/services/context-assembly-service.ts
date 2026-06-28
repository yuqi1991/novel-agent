import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import {
  characterProfiles,
  conversationPositions,
  playerMessages,
  progressWikiDocuments,
  replyVariants,
  storySettings,
  worldEntries
} from "@/db/schema";

type DbExecutor = Pick<Database, "select">;

const idSchema = z.string().trim().min(1, "Id is required");

export const assembleContextPackInput = z.object({
  storyId: idSchema,
  sessionId: idSchema,
  playerMessage: z.string().trim().min(1).max(20_000),
  recentPositionLimit: z.number().int().min(1).max(50).optional().default(10)
});

export type AssembleContextPackInput = z.input<typeof assembleContextPackInput>;

export type ContextPack = Awaited<ReturnType<typeof assembleContextPack>>;
type RecentConversationItem = {
  positionIndex: number;
  role: "player" | "system";
  text: string;
};

export async function assembleContextPack(input: AssembleContextPackInput, database: DbExecutor = db) {
  const parsed = assembleContextPackInput.parse(input);
  const [settings] = await database
    .select()
    .from(storySettings)
    .where(eq(storySettings.storyId, parsed.storyId))
    .limit(1);
  const [profiles, entries, wikiDocuments, recentConversation] = await Promise.all([
    database
      .select()
      .from(characterProfiles)
      .where(eq(characterProfiles.storyId, parsed.storyId))
      .orderBy(asc(characterProfiles.createdAt), asc(characterProfiles.name)),
    database
      .select()
      .from(worldEntries)
      .where(eq(worldEntries.storyId, parsed.storyId))
      .orderBy(asc(worldEntries.createdAt), asc(worldEntries.title)),
    database
      .select()
      .from(progressWikiDocuments)
      .where(eq(progressWikiDocuments.sessionId, parsed.sessionId))
      .orderBy(asc(progressWikiDocuments.createdAt), asc(progressWikiDocuments.title)),
    getRecentSelectedConversation(parsed.sessionId, parsed.recentPositionLimit, database)
  ]);
  const playerCharacter = settings?.playerCharacterProfileId
    ? profiles.find((profile) => profile.id === settings.playerCharacterProfileId) ?? null
    : null;
  const retrievalText = [parsed.playerMessage, ...recentConversation.map((item) => item.text)].join(" ");
  const selectedWorldEntries = entries
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      body: entry.body,
      inclusionMode: entry.inclusionMode,
      reason: getWorldEntryReason(entry, retrievalText)
    }))
    .filter((entry) => entry.reason !== null);

  return {
    storyId: parsed.storyId,
    sessionId: parsed.sessionId,
    playerMessage: parsed.playerMessage,
    recentConversation,
    storyMaterial: {
      fixedContextText: settings?.fixedContextText ?? "",
      characters: profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        role: profile.role,
        profileText: profile.profileText
      })),
      playerCharacter: playerCharacter
        ? {
            id: playerCharacter.id,
            name: playerCharacter.name,
            role: playerCharacter.role,
            profileText: playerCharacter.profileText
          }
        : null
    },
    worldEntries: selectedWorldEntries,
    progressWiki: wikiDocuments.map((document) => ({
      id: document.id,
      title: document.title,
      documentType: document.documentType,
      body: document.body,
      tagsJson: document.tagsJson
    }))
  };
}

async function getRecentSelectedConversation(
  sessionId: string,
  limit: number,
  database: DbExecutor
) {
  const positions = await database
    .select()
    .from(conversationPositions)
    .where(eq(conversationPositions.sessionId, sessionId))
    .orderBy(asc(conversationPositions.positionIndex));
  const messages = await database.select().from(playerMessages).where(eq(playerMessages.sessionId, sessionId));
  const variants = await database.select().from(replyVariants).where(eq(replyVariants.sessionId, sessionId));
  const messageByPositionId = new Map(messages.map((message) => [message.conversationPositionId, message]));
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  const conversationItems: RecentConversationItem[] = [];

  for (const position of positions) {
      if (position.kind === "player_message") {
        const message = messageByPositionId.get(position.id);
        if (message) {
          conversationItems.push({
            positionIndex: position.positionIndex,
            role: "player",
            text: message.messageText
          });
        }
        continue;
      }

      const selectedVariant = position.selectedVariantId ? variantById.get(position.selectedVariantId) : null;
      if (selectedVariant) {
        conversationItems.push({
          positionIndex: position.positionIndex,
          role: "system",
          text: selectedVariant.narrativeResponseText
        });
      }
  }

  return conversationItems.slice(-limit);
}

function getWorldEntryReason(
  entry: typeof worldEntries.$inferSelect,
  retrievalText: string
) {
  if (entry.inclusionMode === "disabled") {
    return null;
  }

  if (entry.inclusionMode === "always") {
    return "always";
  }

  if (entry.inclusionMode === "triggered") {
    return matchesTrigger(entry, retrievalText) ? "triggered" : null;
  }

  return hasSemanticOverlap(`${entry.title} ${entry.body} ${entry.tagsJson}`, retrievalText) ? "semantic" : null;
}

function matchesTrigger(entry: typeof worldEntries.$inferSelect, retrievalText: string) {
  const triggerConfig = parseJson(entry.triggerConfigJson);
  const configuredKeywords = Array.isArray(triggerConfig?.keywords)
    ? triggerConfig.keywords.filter((keyword): keyword is string => typeof keyword === "string")
    : [];
  const tags = parseJsonArray(entry.tagsJson);
  const keywords = configuredKeywords.length > 0 ? configuredKeywords : [...tags, entry.title];
  return keywords.some((keyword) => includesToken(retrievalText, keyword));
}

function hasSemanticOverlap(entryText: string, retrievalText: string) {
  const entryTokens = significantTokens(entryText);
  const retrievalTokens = significantTokens(retrievalText);
  return Array.from(entryTokens).some((token) => retrievalTokens.has(token));
}

function includesToken(text: string, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  return normalizedKeyword.length > 0 && text.toLowerCase().includes(normalizedKeyword);
}

function significantTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9\u4e00-\u9fff]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
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
