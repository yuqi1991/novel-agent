import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import characterFixture from "../../tests/fixtures/sillytavern-character.json";
import worldFixture from "../../tests/fixtures/sillytavern-world.json";
import { createDatabase } from "@/db/client";
import { characterProfiles, importedAssets, worldEntries } from "@/db/schema";
import { createStory } from "./story-service";
import { listStoryMaterial } from "./story-material-service";
import * as sillyTavernImportService from "./sillytavern-import-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-sillytavern-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("sillytavern-import-service", () => {
  it("preserves an Imported Asset and converts a SillyTavern character into a Character Profile", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Tide Archive" }, db);
    const importSillyTavernCharacter = getImportFunction("importSillyTavernCharacter");

    await importSillyTavernCharacter(
      {
        storyId: story.id,
        payload: characterFixture,
        originalFilename: "mira-vale.json",
        contentType: "application/json"
      },
      db
    );

    const assets = await db.select().from(importedAssets);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toEqual(
      expect.objectContaining({
        storyId: story.id,
        sourceType: expect.stringMatching(/^sillytavern_.*character/),
        originalFilename: "mira-vale.json",
        contentType: "application/json",
        rawBlobPath: null
      })
    );
    expect(JSON.parse(assets[0]?.rawPayloadJson ?? "{}")).toEqual(characterFixture);

    const profiles = await db
      .select()
      .from(characterProfiles)
      .where(eq(characterProfiles.importedAssetId, assets[0]?.id ?? ""));
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toEqual(
      expect.objectContaining({
        storyId: story.id,
        importedAssetId: assets[0]?.id,
        name: "Mira Vale",
        role: expect.stringMatching(/^(non_player|unspecified)$/)
      })
    );
    expect(profiles[0]?.profileText).toContain("Archivist who remembers every drowned city.");
    expect(profiles[0]?.profileText).toContain("Careful, curious, and exacting.");
    expect(profiles[0]?.profileText).toContain("Mira is cataloging relics from the Bell Reef");
    expect(profiles[0]?.profileText).toContain("The tide is early. Help me seal the archive.");

    const material = await listStoryMaterial(story.id, db);
    expect(material.characterProfiles).toEqual([
      expect.objectContaining({
        id: profiles[0]?.id,
        importedAssetId: assets[0]?.id,
        name: "Mira Vale"
      })
    ]);
    expect(material.worldEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          importedAssetId: assets[0]?.id,
          title: "Archive Wardens",
          body: "Archive Wardens bind drowned relics with brass bells.",
          inclusionMode: "always"
        }),
        expect.objectContaining({
          importedAssetId: assets[0]?.id,
          title: "Storm Tide",
          body: "The storm tide opens sealed rooms below the Bell Reef.",
          inclusionMode: "triggered"
        })
      ])
    );
  });

  it("preserves an Imported Asset and converts SillyTavern world entries into World Entries", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Bell Reef" }, db);
    const importSillyTavernWorld = getImportFunction("importSillyTavernWorld");

    await importSillyTavernWorld(
      {
        storyId: story.id,
        payload: worldFixture,
        originalFilename: "bell-reef-world.json",
        contentType: "application/json"
      },
      db
    );

    const assets = await db.select().from(importedAssets);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toEqual(
      expect.objectContaining({
        storyId: story.id,
        sourceType: expect.stringMatching(/^sillytavern_.*(world|lorebook)/),
        originalFilename: "bell-reef-world.json",
        contentType: "application/json",
        rawBlobPath: null
      })
    );
    expect(JSON.parse(assets[0]?.rawPayloadJson ?? "{}")).toEqual(worldFixture);

    const entries = await db
      .select()
      .from(worldEntries)
      .where(eq(worldEntries.importedAssetId, assets[0]?.id ?? ""));
    expect(entries).toHaveLength(2);

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          storyId: story.id,
          importedAssetId: assets[0]?.id,
          title: "The Bell Reef",
          body: "A submerged district that rings during storms.",
          inclusionMode: "always"
        }),
        expect.objectContaining({
          storyId: story.id,
          importedAssetId: assets[0]?.id,
          title: "Oath Furnace",
          body: "A legal chamber where vows are burned into iron.",
          inclusionMode: "triggered"
        })
      ])
    );

    const bellReef = entries.find((entry) => entry.title === "The Bell Reef");
    const triggerConfig = JSON.parse(bellReef?.triggerConfigJson ?? "{}");
    expect(triggerConfig.keywords ?? triggerConfig.keys).toEqual(
      expect.arrayContaining(["Bell Reef", "drowned district"])
    );

    const material = await listStoryMaterial(story.id, db);
    expect(material.worldEntries.map((entry) => entry.title)).toEqual(
      expect.arrayContaining(["The Bell Reef", "Oath Furnace"])
    );
  });
});

function getImportFunction(name: "importSillyTavernCharacter" | "importSillyTavernWorld") {
  const candidate = (sillyTavernImportService as Record<string, unknown>)[name];
  expect(candidate, `${name} should be exported from sillytavern-import-service`).toBeTypeOf("function");
  return candidate as (input: {
    storyId: string;
    payload: unknown;
    originalFilename?: string;
    contentType?: string;
  }, database: Awaited<ReturnType<typeof createTestDatabase>>) => Promise<unknown>;
}
