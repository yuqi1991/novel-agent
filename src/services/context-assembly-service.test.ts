import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import { assembleContextPack } from "./context-assembly-service";
import {
  createPlaySession,
  getSessionTranscript,
  rerollLatestReplyVariant,
  selectReplyVariant,
  submitPlayerMessage
} from "./session-service";
import { createProgressWikiDocument } from "./progress-wiki-service";
import { createStory } from "./story-service";
import { createCharacterProfile, createWorldEntry, updatePlayerCharacter } from "./story-material-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-context-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("context-assembly-service", () => {
  it("assembles recent selected-path conversation, player character, selected world entries, and Progress Wiki", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Context Story" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "Context Save" }, db);
    const player = await createCharacterProfile(
      {
        storyId: story.id,
        name: "Iris Quell",
        role: "player",
        profileText: "A cartographer with a copper key."
      },
      db
    );
    await createCharacterProfile(
      {
        storyId: story.id,
        name: "Archivist Mora",
        role: "non_player",
        profileText: "Keeps forbidden ledgers."
      },
      db
    );
    await updatePlayerCharacter({ storyId: story.id, playerCharacterProfileId: player.id }, db);

    await createWorldEntry(
      {
        storyId: story.id,
        title: "Always Market",
        body: "A permanent context location.",
        inclusionMode: "always"
      },
      db
    );
    await createWorldEntry(
      {
        storyId: story.id,
        title: "Brass Door",
        body: "A sealed brass door under the archive.",
        inclusionMode: "triggered",
        triggerConfig: { keywords: ["brass door"] }
      },
      db
    );
    await createWorldEntry(
      {
        storyId: story.id,
        title: "Copper Key",
        body: "A key that opens archive machinery.",
        inclusionMode: "semantic"
      },
      db
    );
    await createWorldEntry(
      {
        storyId: story.id,
        title: "Disabled Tower",
        body: "Should not enter context.",
        inclusionMode: "disabled"
      },
      db
    );
    await createProgressWikiDocument(
      {
        sessionId: session.id,
        title: "Plot State",
        body: "The player owes the archivist a favor."
      },
      db
    );

    const first = await submitPlayerMessage(
      {
        storyId: story.id,
        sessionId: session.id,
        messageText: "I study the copper key."
      },
      db
    );
    await rerollLatestReplyVariant({ storyId: story.id, sessionId: session.id }, db);
    const transcript = await getSessionTranscript({ storyId: story.id, sessionId: session.id }, db);
    const systemPosition = transcript.positions[1];
    if (systemPosition?.kind !== "system_response") {
      throw new Error("Expected system response");
    }
    await selectReplyVariant(
      {
        storyId: story.id,
        sessionId: session.id,
        conversationPositionId: systemPosition.positionId,
        replyVariantId: first.replyVariant.id
      },
      db
    );

    const contextPack = await assembleContextPack(
      {
        storyId: story.id,
        sessionId: session.id,
        playerMessage: "I open the brass door with the copper key."
      },
      db
    );

    expect(contextPack.recentConversation).toEqual([
      expect.objectContaining({
        role: "player",
        text: "I study the copper key."
      }),
      expect.objectContaining({
        role: "system",
        text: first.replyVariant.narrativeResponseText
      })
    ]);
    expect(contextPack.storyMaterial.playerCharacter).toEqual(
      expect.objectContaining({
        id: player.id,
        name: "Iris Quell"
      })
    );
    expect(contextPack.worldEntries.map((entry) => ({ title: entry.title, reason: entry.reason }))).toEqual([
      { title: "Always Market", reason: "always" },
      { title: "Brass Door", reason: "triggered" },
      { title: "Copper Key", reason: "semantic" }
    ]);
    expect(contextPack.progressWiki).toEqual([
      expect.objectContaining({
        title: "Plot State",
        body: "The player owes the archivist a favor."
      })
    ]);
  });

  it("omits optional Player Character when none is configured", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "No Player Character" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "No PC Save" }, db);

    const contextPack = await assembleContextPack(
      {
        storyId: story.id,
        sessionId: session.id,
        playerMessage: "I wait."
      },
      db
    );

    expect(contextPack.storyMaterial.playerCharacter).toBeNull();
  });
});
