import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import {
  conversationPositions,
  playerMessages,
  progressWikiDocuments,
  replyVariants,
  wikiSnapshots,
  workflowTraceSteps,
  workflowTraces
} from "@/db/schema";
import { createStory } from "./story-service";
import {
  createPlaySession,
  forkPlaySession,
  getSessionTranscript,
  listPlaySessions,
  rerollLatestReplyVariant,
  selectReplyVariant,
  submitPlayerMessage
} from "./session-service";
import {
  createProgressWikiDocument,
  createWikiSnapshot,
  updateProgressWikiDocument
} from "./progress-wiki-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-session-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("session-service", () => {
  it("creates multiple Play Sessions under one Story and keeps Conversation Logs isolated", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Parallel Roads" }, db);

    const firstSession = await createPlaySession({ storyId: story.id, title: "Harbor Route" }, db);
    const secondSession = await createPlaySession({ storyId: story.id, title: "Mountain Route" }, db);

    await submitPlayerMessage(
      {
        sessionId: firstSession.id,
        messageText: "I follow the lanterns down to the harbor."
      },
      db
    );

    const sessions = await listPlaySessions(story.id, db);
    const firstTranscript = await getSessionTranscript(firstSession.id, db);
    const secondTranscript = await getSessionTranscript(secondSession.id, db);

    expect(sessions).toEqual([
      expect.objectContaining({ id: firstSession.id, storyId: story.id, title: "Harbor Route" }),
      expect.objectContaining({ id: secondSession.id, storyId: story.id, title: "Mountain Route" })
    ]);
    expect(firstTranscript.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "player_message",
          messageText: "I follow the lanterns down to the harbor."
        }),
        expect.objectContaining({
          kind: "system_response",
          selectedVariant: expect.objectContaining({
            narrativeResponseText: expect.any(String),
            workflowTraceId: expect.any(String)
          })
        })
      ])
    );
    expect(secondTranscript.positions).toEqual([]);
  });

  it("persists one player message, selected Reply Variant, selectedVariantId, and Workflow Trace", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "First Turn" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "Opening Save" }, db);

    const result = await submitPlayerMessage(
      {
        sessionId: session.id,
        messageText: "I knock twice on the observatory door."
      },
      db
    );

    const transcript = await getSessionTranscript(session.id, db);
    const persistedPositions = await db.select().from(conversationPositions);
    const persistedPlayerMessages = await db.select().from(playerMessages);
    const persistedVariants = await db.select().from(replyVariants);
    const persistedTraces = await db.select().from(workflowTraces);
    const persistedTraceSteps = await db.select().from(workflowTraceSteps);

    expect(transcript.positions).toHaveLength(2);
    expect(transcript.positions[0]).toEqual(
      expect.objectContaining({
        positionIndex: 0,
        kind: "player_message",
        messageText: "I knock twice on the observatory door."
      })
    );
    expect(transcript.positions[1]).toEqual(
      expect.objectContaining({
        positionIndex: 1,
        kind: "system_response",
        selectedVariantId: result.replyVariant.id,
        selectedVariant: expect.objectContaining({
          id: result.replyVariant.id,
          narrativeResponseText: expect.any(String),
          workflowTraceId: result.workflowTrace.id
        }),
        variants: expect.arrayContaining([
          expect.objectContaining({
            id: result.replyVariant.id,
            variantIndex: 0,
            narrativeResponseText: expect.any(String),
            workflowTraceId: result.workflowTrace.id
          })
        ])
      })
    );

    expect(persistedPositions).toEqual([
      expect.objectContaining({
        sessionId: session.id,
        positionIndex: 0,
        kind: "player_message",
        selectedVariantId: null
      }),
      expect.objectContaining({
        sessionId: session.id,
        positionIndex: 1,
        kind: "system_response",
        selectedVariantId: result.replyVariant.id
      })
    ]);
    expect(persistedPlayerMessages).toEqual([
      expect.objectContaining({
        sessionId: session.id,
        conversationPositionId: persistedPositions[0]?.id,
        messageText: "I knock twice on the observatory door."
      })
    ]);
    expect(persistedVariants).toEqual([
      expect.objectContaining({
        id: result.replyVariant.id,
        sessionId: session.id,
        conversationPositionId: persistedPositions[1]?.id,
        variantIndex: 0,
        narrativeResponseText: result.replyVariant.narrativeResponseText,
        workflowTraceId: result.workflowTrace.id
      })
    ]);
    expect(result.replyVariant.narrativeResponseText.trim().length).toBeGreaterThan(0);
    expect(persistedTraces).toEqual([
      expect.objectContaining({
        id: result.workflowTrace.id,
        sessionId: session.id,
        status: "succeeded",
        finalOutputText: result.replyVariant.narrativeResponseText
      })
    ]);
    expect(persistedTraceSteps).toEqual([
      expect.objectContaining({
        workflowTraceId: result.workflowTrace.id,
        orderIndex: 0,
        status: "succeeded"
      })
    ]);
  });

  it("rerolls the latest system response into another persisted Reply Variant and selects it", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Forked Replies" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "Mutable Tail" }, db);

    const initial = await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I ask the archivist what the sealed map means."
      },
      db
    );
    const rerolled = await rerollLatestReplyVariant({ storyId: story.id, sessionId: session.id }, db);

    const transcript = await getSessionTranscript({ storyId: story.id, sessionId: session.id }, db);
    const systemPosition = transcript.positions[1];
    const persistedVariants = await db.select().from(replyVariants);

    expect(systemPosition).toEqual(
      expect.objectContaining({
        kind: "system_response",
        selectedVariantId: rerolled.replyVariant.id,
        narrativeResponseText: rerolled.replyVariant.narrativeResponseText,
        selectedVariant: expect.objectContaining({
          id: rerolled.replyVariant.id,
          variantIndex: 1
        }),
        variants: [
          expect.objectContaining({
            id: initial.replyVariant.id,
            variantIndex: 0
          }),
          expect.objectContaining({
            id: rerolled.replyVariant.id,
            variantIndex: 1
          })
        ]
      })
    );
    expect(rerolled.replyVariant.narrativeResponseText).toContain("Alternative 2");
    expect(persistedVariants).toHaveLength(2);
  });

  it("selects a saved latest Reply Variant as the active transcript path", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Selected Reply" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "Latest Choice" }, db);

    const initial = await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I step through the mirror gate."
      },
      db
    );
    await rerollLatestReplyVariant({ storyId: story.id, sessionId: session.id }, db);

    const beforeSelection = await getSessionTranscript({ storyId: story.id, sessionId: session.id }, db);
    const systemPosition = beforeSelection.positions[1];
    if (systemPosition?.kind !== "system_response") {
      throw new Error("Expected system response");
    }

    await selectReplyVariant(
      {
        storyId: story.id,
        sessionId: session.id,
        conversationPositionId: systemPosition.positionId,
        replyVariantId: initial.replyVariant.id
      },
      db
    );

    const afterSelection = await getSessionTranscript({ storyId: story.id, sessionId: session.id }, db);

    expect(afterSelection.positions[1]).toEqual(
      expect.objectContaining({
        kind: "system_response",
        selectedVariantId: initial.replyVariant.id,
        narrativeResponseText: initial.replyVariant.narrativeResponseText,
        selectedVariant: expect.objectContaining({
          id: initial.replyVariant.id,
          variantIndex: 0
        })
      })
    );
  });

  it("prevents selecting a Reply Variant on a non-tail system response", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Locked History" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "Two Turns" }, db);

    const first = await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I open the lower vault."
      },
      db
    );
    await rerollLatestReplyVariant({ storyId: story.id, sessionId: session.id }, db);
    const firstTurnTranscript = await getSessionTranscript({ storyId: story.id, sessionId: session.id }, db);
    const firstSystemPosition = firstTurnTranscript.positions[1];
    if (firstSystemPosition?.kind !== "system_response") {
      throw new Error("Expected first system response");
    }

    await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I carry the brass key upstairs."
      },
      db
    );

    await expect(
      selectReplyVariant(
        {
          storyId: story.id,
          sessionId: session.id,
          conversationPositionId: firstSystemPosition.positionId,
          replyVariantId: first.replyVariant.id
        },
        db
      )
    ).rejects.toThrow("Only the latest system response can change selected Reply Variant");
  });

  it("forks a Play Session through an older Conversation Position and discards later records", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Fork Prefix" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "Source Save" }, db);

    await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I unlock the archive door."
      },
      db
    );
    await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I read the forbidden ledger."
      },
      db
    );

    const sourceTranscript = await getSessionTranscript({ storyId: story.id, sessionId: session.id }, db);
    const forked = await forkPlaySession(
      {
        storyId: story.id,
        sourceSessionId: session.id,
        forkPositionId: sourceTranscript.positions[1]?.positionId ?? "",
        title: "Forked at first response"
      },
      db
    );

    const forkTranscript = await getSessionTranscript({ storyId: story.id, sessionId: forked.id }, db);

    expect(forked).toEqual(
      expect.objectContaining({
        storyId: story.id,
        title: "Forked at first response",
        forkedFromSessionId: session.id,
        forkedFromPosition: 1
      })
    );
    expect(forkTranscript.positions).toHaveLength(2);
    expect(forkTranscript.positions[0]).toEqual(
      expect.objectContaining({
        kind: "player_message",
        positionIndex: 0,
        messageText: "I unlock the archive door."
      })
    );
    expect(forkTranscript.positions[1]).toEqual(
      expect.objectContaining({
        kind: "system_response",
        positionIndex: 1,
        narrativeResponseText: expect.any(String)
      })
    );
    expect(forkTranscript.positions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "player_message",
          messageText: "I read the forbidden ledger."
        })
      ])
    );
  });

  it("forks from an older Reply Variant without mutating the source session", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Variant Fork" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "Source Variant Save" }, db);

    const initial = await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I ask the oracle for a second answer."
      },
      db
    );
    const rerolled = await rerollLatestReplyVariant({ storyId: story.id, sessionId: session.id }, db);
    const sourceBeforeFork = await getSessionTranscript({ storyId: story.id, sessionId: session.id }, db);
    const systemPosition = sourceBeforeFork.positions[1];
    if (systemPosition?.kind !== "system_response") {
      throw new Error("Expected system response");
    }

    await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I accept the oracle's second answer."
      },
      db
    );

    const forked = await forkPlaySession(
      {
        storyId: story.id,
        sourceSessionId: session.id,
        forkPositionId: systemPosition.positionId,
        replyVariantId: initial.replyVariant.id,
        title: "Forked from first answer"
      },
      db
    );

    const sourceAfterFork = await getSessionTranscript({ storyId: story.id, sessionId: session.id }, db);
    const forkTranscript = await getSessionTranscript({ storyId: story.id, sessionId: forked.id }, db);

    expect(sourceAfterFork.positions[1]).toEqual(
      expect.objectContaining({
        kind: "system_response",
        selectedVariantId: rerolled.replyVariant.id,
        narrativeResponseText: rerolled.replyVariant.narrativeResponseText
      })
    );
    expect(forkTranscript.positions).toHaveLength(2);
    expect(forkTranscript.positions[1]).toEqual(
      expect.objectContaining({
        kind: "system_response",
        selectedVariant: expect.objectContaining({
          variantIndex: 0,
          narrativeResponseText: initial.replyVariant.narrativeResponseText
        }),
        narrativeResponseText: initial.replyVariant.narrativeResponseText,
        variants: [
          expect.objectContaining({ variantIndex: 0 }),
          expect.objectContaining({ variantIndex: 1 })
        ]
      })
    );
  });

  it("copies the latest Wiki Snapshot not exceeding the fork position", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Fork Memory Boundary" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "Source Memory Save" }, db);

    await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I mark the old promise in the ledger."
      },
      db
    );
    await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I burn the ledger page."
      },
      db
    );

    const document = await createProgressWikiDocument(
      {
        sessionId: session.id,
        title: "Promise State",
        body: "The promise is recorded."
      },
      db
    );
    await createWikiSnapshot({ sessionId: session.id, memoryBoundaryPosition: 1 }, db);
    await updateProgressWikiDocument(
      {
        sessionId: session.id,
        documentId: document.id,
        title: "Promise State",
        body: "The promise page was burned."
      },
      db
    );
    await createWikiSnapshot({ sessionId: session.id, memoryBoundaryPosition: 3 }, db);

    const sourceTranscript = await getSessionTranscript({ storyId: story.id, sessionId: session.id }, db);
    const forked = await forkPlaySession(
      {
        storyId: story.id,
        sourceSessionId: session.id,
        forkPositionId: sourceTranscript.positions[1]?.positionId ?? "",
        title: "Forked before burn"
      },
      db
    );

    const forkDocuments = await db
      .select()
      .from(progressWikiDocuments)
      .where(eq(progressWikiDocuments.sessionId, forked.id));
    const forkSnapshots = await db.select().from(wikiSnapshots).where(eq(wikiSnapshots.sessionId, forked.id));

    expect(forkSnapshots).toEqual([
      expect.objectContaining({
        sessionId: forked.id,
        memoryBoundaryPosition: 1
      })
    ]);
    expect(forkDocuments).toEqual([
      expect.objectContaining({
        sessionId: forked.id,
        title: "Promise State",
        body: "The promise is recorded."
      })
    ]);
  });
});
