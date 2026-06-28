import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import { storySettings } from "@/db/schema";
import { createStory } from "./story-service";
import {
  createCharacterProfile,
  createWorldEntry,
  deleteCharacterProfile,
  deleteWorldEntry,
  listStoryMaterial,
  updateCharacterProfile,
  updatePlayerCharacter,
  updateWorldEntry
} from "./story-material-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-material-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("story-material-service", () => {
  it("lists Character Profiles and World Entries for a Story", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Tide Archive" }, db);

    const character = await createCharacterProfile(
      {
        storyId: story.id,
        name: "Mira Vale",
        role: "non_player",
        profileText: "Archivist who remembers every drowned city."
      },
      db
    );
    const worldEntry = await createWorldEntry(
      {
        storyId: story.id,
        title: "The Bell Reef",
        body: "A submerged district that rings during storms.",
        inclusionMode: "always",
        tags: ["place", "mystery"]
      },
      db
    );

    const material = await listStoryMaterial(story.id, db);

    expect(material.characterProfiles).toEqual([
      expect.objectContaining({
        id: character.id,
        storyId: story.id,
        name: "Mira Vale",
        role: "non_player",
        profileText: "Archivist who remembers every drowned city."
      })
    ]);
    expect(material.worldEntries).toEqual([
      expect.objectContaining({
        id: worldEntry.id,
        storyId: story.id,
        title: "The Bell Reef",
        body: "A submerged district that rings during storms.",
        inclusionMode: "always"
      })
    ]);
  });

  it("defaults World Entry inclusion mode to semantic", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Lantern Road" }, db);

    const worldEntry = await createWorldEntry(
      {
        storyId: story.id,
        title: "Courier Shrines",
        body: "Small roadside shrines where messages are left for spirits."
      },
      db
    );

    expect(worldEntry.inclusionMode).toBe("semantic");
  });

  it("updates Character Profile and World Entry details", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Editable Material" }, db);
    const character = await createCharacterProfile(
      {
        storyId: story.id,
        name: "Old Name",
        role: "unspecified",
        profileText: "Old profile."
      },
      db
    );
    const worldEntry = await createWorldEntry(
      {
        storyId: story.id,
        title: "Old Place",
        body: "Old world text.",
        inclusionMode: "semantic",
        triggerConfig: { keywords: ["old"] },
        tags: ["archive"]
      },
      db
    );

    const updatedCharacter = await updateCharacterProfile(
      {
        storyId: story.id,
        profileId: character.id,
        name: "New Name",
        role: "non_player",
        profileText: "New profile."
      },
      db
    );
    const updatedWorldEntry = await updateWorldEntry(
      {
        storyId: story.id,
        worldEntryId: worldEntry.id,
        title: "New Place",
        body: "New world text.",
        inclusionMode: "always"
      },
      db
    );

    expect(updatedCharacter).toEqual(
      expect.objectContaining({
        id: character.id,
        name: "New Name",
        role: "non_player",
        profileText: "New profile."
      })
    );
    expect(updatedWorldEntry).toEqual(
      expect.objectContaining({
        id: worldEntry.id,
        title: "New Place",
        body: "New world text.",
        inclusionMode: "always"
      })
    );
    expect(updatedWorldEntry.triggerConfigJson).toBe(JSON.stringify({ keywords: ["old"] }));
    expect(updatedWorldEntry.tagsJson).toBe(JSON.stringify(["archive"]));
  });

  it("sets, changes, and clears the optional Player Character", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Glass Frontier" }, db);
    const firstCharacter = await createCharacterProfile(
      {
        storyId: story.id,
        name: "Iris Quell",
        role: "player",
        profileText: "A cartographer searching for a vanished coast."
      },
      db
    );
    const secondCharacter = await createCharacterProfile(
      {
        storyId: story.id,
        name: "Ren Ash",
        role: "player",
        profileText: "A courier carrying a sealed confession."
      },
      db
    );

    await updatePlayerCharacter(
      { storyId: story.id, playerCharacterProfileId: firstCharacter.id },
      db
    );
    let [settings] = await db.select().from(storySettings);
    expect(settings?.playerCharacterProfileId).toBe(firstCharacter.id);

    await updatePlayerCharacter(
      { storyId: story.id, playerCharacterProfileId: secondCharacter.id },
      db
    );
    [settings] = await db.select().from(storySettings);
    expect(settings?.playerCharacterProfileId).toBe(secondCharacter.id);

    await updatePlayerCharacter({ storyId: story.id, playerCharacterProfileId: "" }, db);
    [settings] = await db.select().from(storySettings);
    expect(settings?.playerCharacterProfileId).toBeNull();
  });

  it("deletes Character Profiles and World Entries without deleting the Story", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Ember Court" }, db);
    const character = await createCharacterProfile(
      {
        storyId: story.id,
        name: "Sable Minister",
        role: "non_player",
        profileText: "Keeps the court calendar and its grudges."
      },
      db
    );
    const worldEntry = await createWorldEntry(
      {
        storyId: story.id,
        title: "Oath Furnace",
        body: "A legal chamber where vows are burned into iron.",
        inclusionMode: "triggered",
        triggerConfig: { keywords: ["oath", "furnace"] }
      },
      db
    );

    await deleteCharacterProfile({ storyId: story.id, profileId: character.id }, db);
    await deleteWorldEntry({ storyId: story.id, worldEntryId: worldEntry.id }, db);

    const material = await listStoryMaterial(story.id, db);
    expect(material.characterProfiles).toEqual([]);
    expect(material.worldEntries).toEqual([]);
  });

  it("rejects blank Character Profile names and World Entry titles", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Hollow Market" }, db);

    await expect(
      createCharacterProfile({ storyId: story.id, name: "   ", profileText: "Blank name" }, db)
    ).rejects.toThrow(/Character name is required/);
    await expect(
      createWorldEntry({ storyId: story.id, title: "   ", body: "Blank title" }, db)
    ).rejects.toThrow(/World entry title is required/);
  });
});
