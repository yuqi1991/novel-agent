import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import { createPlaySession } from "./session-service";
import {
  createProgressWikiDocument,
  createWikiSnapshot,
  listProgressWiki,
  updateProgressWikiDocument
} from "./progress-wiki-service";
import { createStory } from "./story-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-wiki-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("progress-wiki-service", () => {
  it("keeps Progress Wiki documents isolated by Play Session", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Session Memory" }, db);
    const firstSession = await createPlaySession({ storyId: story.id, title: "First Save" }, db);
    const secondSession = await createPlaySession({ storyId: story.id, title: "Second Save" }, db);

    await createProgressWikiDocument(
      {
        sessionId: firstSession.id,
        title: "First Route State",
        body: "The archivist trusts the player."
      },
      db
    );
    await createProgressWikiDocument(
      {
        sessionId: secondSession.id,
        title: "Second Route State",
        body: "The archivist distrusts the player."
      },
      db
    );

    const firstWiki = await listProgressWiki(firstSession.id, db);
    const secondWiki = await listProgressWiki(secondSession.id, db);

    expect(firstWiki.documents).toEqual([
      expect.objectContaining({
        sessionId: firstSession.id,
        title: "First Route State"
      })
    ]);
    expect(secondWiki.documents).toEqual([
      expect.objectContaining({
        sessionId: secondSession.id,
        title: "Second Route State"
      })
    ]);
  });

  it("updates a Progress Wiki document and creates cumulative snapshots", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Cumulative Memory" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "Snapshot Save" }, db);

    const document = await createProgressWikiDocument(
      {
        sessionId: session.id,
        title: "Plot State",
        body: "The player found a copper key."
      },
      db
    );
    await updateProgressWikiDocument(
      {
        sessionId: session.id,
        documentId: document.id,
        title: "Plot State",
        body: "The player found a copper key and hid it under the stair."
      },
      db
    );

    const snapshot = await createWikiSnapshot(
      {
        sessionId: session.id,
        memoryBoundaryPosition: 20
      },
      db
    );
    const payload = JSON.parse(snapshot.snapshotPayloadJson) as {
      memoryBoundaryPosition: number;
      documents: Array<{ title: string; body: string }>;
    };

    expect(payload).toEqual({
      memoryBoundaryPosition: 20,
      documents: [
        expect.objectContaining({
          title: "Plot State",
          body: "The player found a copper key and hid it under the stair."
        })
      ]
    });
  });
});
