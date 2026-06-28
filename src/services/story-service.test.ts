import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import { storySettings } from "@/db/schema";
import { createStory, listStories } from "./story-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("story-service", () => {
  it("creates a Story with default settings and lists it", async () => {
    const db = await createTestDatabase();

    const story = await createStory({ title: "Cyber Jianghu", description: "Neon sects." }, db);
    const allStories = await listStories(db);
    const settings = await db.select().from(storySettings);

    expect(story.title).toBe("Cyber Jianghu");
    expect(allStories).toHaveLength(1);
    expect(allStories[0]?.description).toBe("Neon sects.");
    expect(settings).toHaveLength(1);
    expect(settings[0]?.storyId).toBe(story.id);
  });

  it("rejects blank Story titles", async () => {
    const db = await createTestDatabase();
    await expect(createStory({ title: "   " }, db)).rejects.toThrow(/Story title is required/);
  });
});
