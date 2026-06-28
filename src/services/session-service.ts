import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import {
  conversationPositions,
  playerMessages,
  playSessions,
  replyVariants,
  stories,
  workflowTraces
} from "@/db/schema";
import { newId } from "@/domain/ids";
import { runGenerationWorkflow } from "./orchestration-service";
import { copyEligibleWikiSnapshotForFork } from "./progress-wiki-service";
import { ensureSessionDataDirectory } from "./user-data-storage";

const idSchema = z.string().trim().min(1, "Id is required");
const storyIdSchema = z.string().trim().min(1, "Story id is required");

export const createPlaySessionInput = z.object({
  storyId: storyIdSchema,
  title: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1, "Session title is required").max(120).optional()
  )
});

export const getSessionTranscriptInput = z.object({
  storyId: storyIdSchema,
  sessionId: idSchema
});

export const submitPlayerMessageInput = z.object({
  storyId: storyIdSchema,
  sessionId: idSchema,
  messageText: z.string().trim().min(1, "Player message is required").max(20_000)
});

export const rerollLatestReplyVariantInput = z.object({
  storyId: storyIdSchema,
  sessionId: idSchema
});

export const selectReplyVariantInput = z.object({
  storyId: storyIdSchema,
  sessionId: idSchema,
  conversationPositionId: idSchema,
  replyVariantId: idSchema
});

export const forkPlaySessionInput = z.object({
  storyId: storyIdSchema,
  sourceSessionId: idSchema,
  forkPositionId: idSchema,
  replyVariantId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    idSchema.optional()
  ),
  title: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1, "Fork title is required").max(120).optional()
  )
});

export type CreatePlaySessionInput = z.input<typeof createPlaySessionInput>;
export type GetSessionTranscriptInput = z.input<typeof getSessionTranscriptInput>;
export type SubmitPlayerMessageInput = z.input<typeof submitPlayerMessageInput>;
export type RerollLatestReplyVariantInput = z.input<typeof rerollLatestReplyVariantInput>;
export type SelectReplyVariantInput = z.input<typeof selectReplyVariantInput>;
export type ForkPlaySessionInput = z.input<typeof forkPlaySessionInput>;

export type SessionTranscriptItem =
  | {
      positionId: string;
      positionIndex: number;
      kind: "player_message";
      messageId: string;
      messageText: string;
      createdAt: string;
    }
  | {
      positionId: string;
      positionIndex: number;
      kind: "system_response";
      selectedVariantId: string | null;
      narrativeResponseText: string;
      workflowTraceId: string | null;
      createdAt: string;
    };

export type SessionTranscriptPosition =
  | SessionTranscriptItem
  | {
      positionId: string;
      positionIndex: number;
      kind: "system_response";
      selectedVariantId: string | null;
      selectedVariant: (typeof replyVariants.$inferSelect) | null;
      variants: (typeof replyVariants.$inferSelect)[];
      createdAt: string;
    };

export async function createPlaySession(input: CreatePlaySessionInput, database: Database = db) {
  const parsed = createPlaySessionInput.parse(input);
  await assertStoryExists(parsed.storyId, database);

  const id = newId("session");
  await database.insert(playSessions).values({
    id,
    storyId: parsed.storyId,
    title: parsed.title ?? "New Play Session"
  });

  const [session] = await database.select().from(playSessions).where(eq(playSessions.id, id)).limit(1);
  if (!session) {
    throw new Error("Play Session was not persisted");
  }
  ensureSessionDataDirectory({ storyId: session.storyId, sessionId: session.id });
  return session;
}

export async function listPlaySessions(storyId: string, database: Database = db) {
  const parsedStoryId = storyIdSchema.parse(storyId);

  return database
    .select()
    .from(playSessions)
    .where(eq(playSessions.storyId, parsedStoryId))
    .orderBy(asc(playSessions.createdAt), asc(playSessions.title));
}

export async function ensureDefaultPlaySession(storyId: string, database: Database = db) {
  const parsedStoryId = storyIdSchema.parse(storyId);
  await assertStoryExists(parsedStoryId, database);

  const sessions = await listPlaySessions(parsedStoryId, database);
  const latestSession = sessions.at(-1);
  if (latestSession) {
    return latestSession;
  }

  return createPlaySession({ storyId: parsedStoryId, title: "默认存档" }, database);
}

export async function getSessionTranscript(
  input: GetSessionTranscriptInput | string,
  database: Database = db
) {
  const parsed =
    typeof input === "string"
      ? { storyId: null, sessionId: idSchema.parse(input) }
      : { ...getSessionTranscriptInput.parse(input), storyId: input.storyId };
  if (parsed.storyId) {
    await assertSessionBelongsToStory(parsed.sessionId, parsed.storyId, database);
  }

  const positions = await database
    .select()
    .from(conversationPositions)
    .where(eq(conversationPositions.sessionId, parsed.sessionId))
    .orderBy(asc(conversationPositions.positionIndex));
  const messages = await database
    .select()
    .from(playerMessages)
    .where(eq(playerMessages.sessionId, parsed.sessionId));
  const variants = await database
    .select()
    .from(replyVariants)
    .where(eq(replyVariants.sessionId, parsed.sessionId));

  const messageByPositionId = new Map(messages.map((message) => [message.conversationPositionId, message]));
  const selectedVariantById = new Map(variants.map((variant) => [variant.id, variant]));
  const firstVariantByPositionId = new Map<string, (typeof variants)[number]>();
  for (const variant of variants) {
    const existing = firstVariantByPositionId.get(variant.conversationPositionId);
    if (!existing || variant.variantIndex < existing.variantIndex) {
      firstVariantByPositionId.set(variant.conversationPositionId, variant);
    }
  }

  const transcriptPositions = positions.flatMap((position): SessionTranscriptPosition[] => {
    if (position.kind === "player_message") {
      const message = messageByPositionId.get(position.id);
      return message
        ? [
            {
              positionId: position.id,
              positionIndex: position.positionIndex,
              kind: "player_message",
              messageId: message.id,
              messageText: message.messageText,
              createdAt: position.createdAt
            }
          ]
        : [];
    }

    const variant =
      (position.selectedVariantId ? selectedVariantById.get(position.selectedVariantId) : null) ??
      firstVariantByPositionId.get(position.id);
    const positionVariants = variants
      .filter((replyVariant) => replyVariant.conversationPositionId === position.id)
      .sort((left, right) => left.variantIndex - right.variantIndex);

    return [
      {
        positionId: position.id,
        positionIndex: position.positionIndex,
        kind: "system_response",
        selectedVariantId: position.selectedVariantId,
        selectedVariant: variant ?? null,
        variants: positionVariants,
        narrativeResponseText: variant?.narrativeResponseText ?? "",
        workflowTraceId: variant?.workflowTraceId ?? null,
        createdAt: position.createdAt
      }
    ];
  });

  return { positions: transcriptPositions };
}

export async function submitPlayerMessage(
  input: SubmitPlayerMessageInput | Omit<SubmitPlayerMessageInput, "storyId">,
  database: Database = db
) {
  const partialInput = z.object({
    sessionId: idSchema,
    messageText: z.string().trim().min(1, "Player message is required").max(20_000)
  });
  const parsedInput = "storyId" in input ? submitPlayerMessageInput.parse(input) : partialInput.parse(input);

  const sessionId: string = parsedInput.sessionId;
  const messageText: string = parsedInput.messageText;
  const explicitStoryId = "storyId" in parsedInput ? String(parsedInput.storyId) : null;
  const storyId = explicitStoryId ?? (await getSessionStoryId(sessionId, database));
  const playerTurn = await database.transaction(async (tx) => {
    await assertSessionBelongsToStory(sessionId, storyId, tx);

    const playerPositionIndex = await nextPositionIndex(sessionId, tx);
    const playerPositionId = newId("pos");
    const playerMessageId = newId("msg");

    await tx.insert(conversationPositions).values({
      id: playerPositionId,
      sessionId,
      positionIndex: playerPositionIndex,
      kind: "player_message"
    });
    await tx.insert(playerMessages).values({
      id: playerMessageId,
      sessionId,
      conversationPositionId: playerPositionId,
      messageText
    });

    return { playerPositionIndex, playerPositionId, playerMessageId };
  });

  let workflow: Awaited<ReturnType<typeof runGenerationWorkflow>>;
  try {
    workflow = await runGenerationWorkflow(
      {
        storyId,
        sessionId,
        playerMessage: messageText
      },
      database
    );
  } catch (error) {
    await removePlayerTurn(sessionId, playerTurn.playerPositionId, playerTurn.playerMessageId, database);
    throw error;
  }

  return database.transaction(async (tx) => {
    const systemPositionId = newId("pos");
    const replyVariantId = newId("variant");
    await tx.insert(conversationPositions).values({
      id: systemPositionId,
      sessionId,
      positionIndex: playerTurn.playerPositionIndex + 1,
      kind: "system_response",
      selectedVariantId: replyVariantId
    });
    await tx.insert(replyVariants).values({
      id: replyVariantId,
      sessionId,
      conversationPositionId: systemPositionId,
      variantIndex: 0,
      narrativeResponseText: workflow.narrativeResponseText,
      workflowTraceId: workflow.workflowTraceId
    });

    const [replyVariant] = await tx.select().from(replyVariants).where(eq(replyVariants.id, replyVariantId)).limit(1);
    const [workflowTrace] = await tx
      .select()
      .from(workflowTraces)
      .where(eq(workflowTraces.id, workflow.workflowTraceId))
      .limit(1);

    if (!replyVariant || !workflowTrace) {
      throw new Error("Generated response was not persisted");
    }

    return {
      playerPositionId: playerTurn.playerPositionId,
      playerMessageId: playerTurn.playerMessageId,
      systemPositionId,
      replyVariantId,
      selectedVariantId: replyVariantId,
      workflowTraceId: workflow.workflowTraceId,
      narrativeResponseText: workflow.narrativeResponseText,
      replyVariant,
      workflowTrace
    };
  });
}

export async function rerollLatestReplyVariant(
  input: RerollLatestReplyVariantInput,
  database: Database = db
) {
  const parsed = rerollLatestReplyVariantInput.parse(input);

  const rerollContext = await database.transaction(async (tx) => {
    await assertSessionBelongsToStory(parsed.sessionId, parsed.storyId, tx);
    const systemPosition = await getMutableTailSystemPosition(parsed.sessionId, tx);
    const playerMessage = await getPlayerMessageBeforeSystemPosition(parsed.sessionId, systemPosition.positionIndex, tx);
    const nextVariantIndex = await nextReplyVariantIndex(parsed.sessionId, systemPosition.id, tx);
    return { systemPosition, playerMessage, nextVariantIndex };
  });

  const workflow = await runGenerationWorkflow(
    {
      storyId: parsed.storyId,
      sessionId: parsed.sessionId,
      playerMessage: rerollContext.playerMessage.messageText,
      variantIndex: rerollContext.nextVariantIndex
    },
    database
  );

  return database.transaction(async (tx) => {
    const replyVariantId = newId("variant");
    await tx.insert(replyVariants).values({
      id: replyVariantId,
      sessionId: parsed.sessionId,
      conversationPositionId: rerollContext.systemPosition.id,
      variantIndex: rerollContext.nextVariantIndex,
      narrativeResponseText: workflow.narrativeResponseText,
      workflowTraceId: workflow.workflowTraceId
    });
    await tx
      .update(conversationPositions)
      .set({ selectedVariantId: replyVariantId })
      .where(eq(conversationPositions.id, rerollContext.systemPosition.id));

    const [replyVariant] = await tx.select().from(replyVariants).where(eq(replyVariants.id, replyVariantId)).limit(1);
    const [workflowTrace] = await tx
      .select()
      .from(workflowTraces)
      .where(eq(workflowTraces.id, workflow.workflowTraceId))
      .limit(1);

    if (!replyVariant || !workflowTrace) {
      throw new Error("Rerolled Reply Variant was not persisted");
    }

    return {
      conversationPositionId: rerollContext.systemPosition.id,
      selectedVariantId: replyVariantId,
      replyVariant,
      workflowTrace
    };
  });
}

export async function selectReplyVariant(input: SelectReplyVariantInput, database: Database = db) {
  const parsed = selectReplyVariantInput.parse(input);

  return database.transaction(async (tx) => {
    await assertSessionBelongsToStory(parsed.sessionId, parsed.storyId, tx);
    const systemPosition = await getMutableTailSystemPosition(parsed.sessionId, tx);

    if (systemPosition.id !== parsed.conversationPositionId) {
      throw new Error("Only the latest system response can change selected Reply Variant");
    }

    const [replyVariant] = await tx
      .select()
      .from(replyVariants)
      .where(
        and(
          eq(replyVariants.id, parsed.replyVariantId),
          eq(replyVariants.sessionId, parsed.sessionId),
          eq(replyVariants.conversationPositionId, parsed.conversationPositionId)
        )
      )
      .limit(1);

    if (!replyVariant) {
      throw new Error("Reply Variant does not belong to the latest system response");
    }

    await tx
      .update(conversationPositions)
      .set({ selectedVariantId: replyVariant.id })
      .where(eq(conversationPositions.id, systemPosition.id));

    return {
      conversationPositionId: systemPosition.id,
      selectedVariantId: replyVariant.id,
      replyVariant
    };
  });
}

export async function forkPlaySession(input: ForkPlaySessionInput, database: Database = db) {
  const parsed = forkPlaySessionInput.parse(input);

  return database.transaction(async (tx) => {
    await assertSessionBelongsToStory(parsed.sourceSessionId, parsed.storyId, tx);

    const [sourceSession] = await tx
      .select()
      .from(playSessions)
      .where(eq(playSessions.id, parsed.sourceSessionId))
      .limit(1);
    const [forkPosition] = await tx
      .select()
      .from(conversationPositions)
      .where(
        and(
          eq(conversationPositions.id, parsed.forkPositionId),
          eq(conversationPositions.sessionId, parsed.sourceSessionId)
        )
      )
      .limit(1);

    if (!sourceSession || !forkPosition) {
      throw new Error("Fork source was not found");
    }

    const sourcePositions = await tx
      .select()
      .from(conversationPositions)
      .where(eq(conversationPositions.sessionId, parsed.sourceSessionId))
      .orderBy(asc(conversationPositions.positionIndex));
    const prefixPositions = sourcePositions.filter(
      (position) => position.positionIndex <= forkPosition.positionIndex
    );
    const sourcePositionIds = new Set(prefixPositions.map((position) => position.id));
    const sourceMessages = await tx
      .select()
      .from(playerMessages)
      .where(eq(playerMessages.sessionId, parsed.sourceSessionId));
    const sourceVariants = await tx
      .select()
      .from(replyVariants)
      .where(eq(replyVariants.sessionId, parsed.sourceSessionId));

    const requestedForkVariant = parsed.replyVariantId
      ? sourceVariants.find(
          (variant) =>
            variant.id === parsed.replyVariantId && variant.conversationPositionId === forkPosition.id
        )
      : null;

    if (parsed.replyVariantId && !requestedForkVariant) {
      throw new Error("Fork Reply Variant does not belong to the fork position");
    }

    if (parsed.replyVariantId && forkPosition.kind !== "system_response") {
      throw new Error("Only system response positions can fork from a Reply Variant");
    }

    const forkSessionId = newId("session");
    await tx.insert(playSessions).values({
      id: forkSessionId,
      storyId: parsed.storyId,
      title: parsed.title ?? `Fork of ${sourceSession.title} at ${forkPosition.positionIndex}`,
      forkedFromSessionId: parsed.sourceSessionId,
      forkedFromPosition: forkPosition.positionIndex
    });

    const positionIdMap = new Map<string, string>();
    const variantIdMap = new Map<string, string>();
    const copiedVariantsBySourcePositionId = new Map<string, typeof sourceVariants>();

    for (const position of prefixPositions) {
      positionIdMap.set(position.id, newId("pos"));
    }

    for (const variant of sourceVariants) {
      if (!sourcePositionIds.has(variant.conversationPositionId)) {
        continue;
      }
      variantIdMap.set(variant.id, newId("variant"));
      const variants = copiedVariantsBySourcePositionId.get(variant.conversationPositionId) ?? [];
      variants.push(variant);
      copiedVariantsBySourcePositionId.set(variant.conversationPositionId, variants);
    }

    for (const position of prefixPositions) {
      const newPositionId = mustGet(positionIdMap, position.id);
      const selectedVariantSourceId =
        parsed.replyVariantId && position.id === forkPosition.id
          ? parsed.replyVariantId
          : position.selectedVariantId;

      await tx.insert(conversationPositions).values({
        id: newPositionId,
        sessionId: forkSessionId,
        positionIndex: position.positionIndex,
        kind: position.kind,
        selectedVariantId: selectedVariantSourceId ? variantIdMap.get(selectedVariantSourceId) ?? null : null
      });
    }

    for (const message of sourceMessages) {
      if (!sourcePositionIds.has(message.conversationPositionId)) {
        continue;
      }
      await tx.insert(playerMessages).values({
        id: newId("msg"),
        sessionId: forkSessionId,
        conversationPositionId: mustGet(positionIdMap, message.conversationPositionId),
        messageText: message.messageText
      });
    }

    for (const position of prefixPositions) {
      const variants = copiedVariantsBySourcePositionId
        .get(position.id)
        ?.sort((left, right) => left.variantIndex - right.variantIndex);
      if (!variants) {
        continue;
      }

      for (const variant of variants) {
        await tx.insert(replyVariants).values({
          id: mustGet(variantIdMap, variant.id),
          sessionId: forkSessionId,
          conversationPositionId: mustGet(positionIdMap, variant.conversationPositionId),
          variantIndex: variant.variantIndex,
          narrativeResponseText: variant.narrativeResponseText,
          workflowTraceId: variant.workflowTraceId
        });
      }
    }

    await copyEligibleWikiSnapshotForFork(
      {
        sourceSessionId: parsed.sourceSessionId,
        targetSessionId: forkSessionId,
        forkPosition: forkPosition.positionIndex
      },
      tx
    );

    const [forkedSession] = await tx
      .select()
      .from(playSessions)
      .where(eq(playSessions.id, forkSessionId))
      .limit(1);

    if (!forkedSession) {
      throw new Error("Forked Play Session was not persisted");
    }
    ensureSessionDataDirectory({ storyId: forkedSession.storyId, sessionId: forkedSession.id });

    return forkedSession;
  });
}

async function assertStoryExists(storyId: string, database: Pick<Database, "select">) {
  const [story] = await database.select({ id: stories.id }).from(stories).where(eq(stories.id, storyId)).limit(1);
  if (!story) {
    throw new Error("Story not found");
  }
}

async function assertSessionBelongsToStory(
  sessionId: string,
  storyId: string,
  database: Pick<Database, "select">
) {
  const [session] = await database
    .select({ id: playSessions.id })
    .from(playSessions)
    .where(and(eq(playSessions.id, sessionId), eq(playSessions.storyId, storyId)))
    .limit(1);

  if (!session) {
    throw new Error("Play Session does not belong to this Story");
  }
}

async function getSessionStoryId(sessionId: string, database: Pick<Database, "select">) {
  const [session] = await database
    .select({ storyId: playSessions.storyId })
    .from(playSessions)
    .where(eq(playSessions.id, sessionId))
    .limit(1);

  if (!session) {
    throw new Error("Play Session not found");
  }
  return session.storyId;
}

async function getMutableTailSystemPosition(sessionId: string, database: Pick<Database, "select">) {
  const [position] = await database
    .select()
    .from(conversationPositions)
    .where(eq(conversationPositions.sessionId, sessionId))
    .orderBy(desc(conversationPositions.positionIndex))
    .limit(1);

  if (!position) {
    throw new Error("Play Session has no conversation positions");
  }

  if (position.kind !== "system_response") {
    throw new Error("Mutable Tail is not a system response");
  }

  return position;
}

async function getPlayerMessageBeforeSystemPosition(
  sessionId: string,
  systemPositionIndex: number,
  database: Pick<Database, "select">
) {
  const [position] = await database
    .select()
    .from(conversationPositions)
    .where(
      and(
        eq(conversationPositions.sessionId, sessionId),
        eq(conversationPositions.positionIndex, systemPositionIndex - 1),
        eq(conversationPositions.kind, "player_message")
      )
    )
    .limit(1);

  if (!position) {
    throw new Error("Latest system response has no preceding player message");
  }

  const [message] = await database
    .select()
    .from(playerMessages)
    .where(
      and(
        eq(playerMessages.sessionId, sessionId),
        eq(playerMessages.conversationPositionId, position.id)
      )
    )
    .limit(1);

  if (!message) {
    throw new Error("Preceding player message was not found");
  }

  return message;
}

async function nextReplyVariantIndex(
  sessionId: string,
  conversationPositionId: string,
  database: Pick<Database, "select">
) {
  const [row] = await database
    .select({
      nextIndex: sql<number>`coalesce(max(${replyVariants.variantIndex}), -1) + 1`
    })
    .from(replyVariants)
    .where(
      and(
        eq(replyVariants.sessionId, sessionId),
        eq(replyVariants.conversationPositionId, conversationPositionId)
      )
    );

  return row?.nextIndex ?? 0;
}

async function nextPositionIndex(sessionId: string, database: Pick<Database, "select">) {
  const [row] = await database
    .select({
      nextIndex: sql<number>`coalesce(max(${conversationPositions.positionIndex}), -1) + 1`
    })
    .from(conversationPositions)
    .where(eq(conversationPositions.sessionId, sessionId));

  return row?.nextIndex ?? 0;
}

async function removePlayerTurn(
  sessionId: string,
  playerPositionId: string,
  playerMessageId: string,
  database: Database
) {
  await database
    .delete(playerMessages)
    .where(and(eq(playerMessages.id, playerMessageId), eq(playerMessages.sessionId, sessionId)));
  await database
    .delete(conversationPositions)
    .where(and(eq(conversationPositions.id, playerPositionId), eq(conversationPositions.sessionId, sessionId)));
}

function mustGet(map: Map<string, string>, key: string) {
  const value = map.get(key);
  if (!value) {
    throw new Error("Fork copy mapping was not found");
  }
  return value;
}
