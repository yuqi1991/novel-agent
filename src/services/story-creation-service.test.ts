import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import { characterProfiles, importedAssets, worldEntries } from "@/db/schema";
import { createStoryFromDraft, parseSillyTavernStoryDraft } from "./story-creation-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-story-draft-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("story-creation-service", () => {
  it("parses SillyTavern character JSON into a story creation draft", () => {
    const draft = parseSillyTavernStoryDraft({
      sourceType: "character_card",
      originalFilename: "azura.json",
      jsonText: JSON.stringify({
        name: "Azura",
        description: "Magic instructor.",
        personality: "Patient and playful."
      })
    });

    expect(draft).toEqual(
      expect.objectContaining({
        title: "Azura",
        importedAssets: [expect.objectContaining({ sourceType: "sillytavern_character_card" })],
        characterProfiles: [
          expect.objectContaining({
            name: "Azura",
            profileText: expect.stringContaining("Magic instructor.")
          })
        ],
        worldEntries: []
      })
    );
  });

  it("creates a Story with imported assets, Character Profiles, and World Entries from one draft", async () => {
    const db = await createTestDatabase();
    const draft = parseSillyTavernStoryDraft({
      sourceType: "world_lorebook",
      originalFilename: "academy.json",
      jsonText: JSON.stringify({
        entries: [
          {
            comment: "皇家魔法学院",
            key: ["学院"],
            content: "学生学习基础魔法的地方。"
          }
        ]
      })
    });

    const story = await createStoryFromDraft(
      {
        title: "学院故事",
        description: "导入后创建。",
        importedAssetsJson: JSON.stringify(draft.importedAssets),
        characterProfilesJson: JSON.stringify([
          {
            name: "Azura",
            role: "non_player",
            profileText: "魔法老师。",
            metadataJson: "{}"
          }
        ]),
        worldEntriesJson: JSON.stringify(draft.worldEntries)
      },
      db
    );

    const [asset] = await db.select().from(importedAssets);
    const [character] = await db.select().from(characterProfiles);
    const [worldEntry] = await db.select().from(worldEntries);

    expect(story).toEqual(expect.objectContaining({ title: "学院故事" }));
    expect(asset).toEqual(expect.objectContaining({ storyId: story.id, sourceType: "sillytavern_world_lorebook" }));
    expect(character).toEqual(expect.objectContaining({ storyId: story.id, name: "Azura" }));
    expect(worldEntry).toEqual(
      expect.objectContaining({
        storyId: story.id,
        importedAssetId: asset?.id,
        title: "皇家魔法学院",
        inclusionMode: "triggered"
      })
    );
  });
});
