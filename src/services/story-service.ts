import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import { stories, storySettings } from "@/db/schema";
import { newId } from "@/domain/ids";
import { ensureStoryDataDirectory } from "./user-data-storage";

export const createStoryInput = z.object({
  title: z.string().trim().min(1, "Story title is required").max(120),
  description: z.string().trim().max(2_000).optional().default("")
});

export type CreateStoryInput = z.input<typeof createStoryInput>;

export async function listStories(database: Database = db) {
  return database.select().from(stories).orderBy(asc(stories.createdAt));
}

export async function getStory(storyId: string, database: Database = db) {
  const [story] = await database.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  return story ?? null;
}

export async function createStory(input: CreateStoryInput, database: Database = db) {
  const parsed = createStoryInput.parse(input);
  const id = newId("story");

  await database.transaction(async (tx) => {
    await tx.insert(stories).values({
      id,
      title: parsed.title,
      description: parsed.description
    });

    await tx.insert(storySettings).values({
      storyId: id
    });
  });

  const story = await getStory(id, database);
  if (!story) {
    throw new Error("Story was not persisted");
  }
  ensureStoryDataDirectory(story.id);
  return story;
}
