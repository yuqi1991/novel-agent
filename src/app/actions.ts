"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createStory, updateStory } from "@/services/story-service";
import {
  createStoryFromDraft,
  parseSillyTavernStoryDraft
} from "@/services/story-creation-service";

export async function createStoryAction(formData: FormData) {
  const story = await createStory({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? "")
  });

  revalidatePath("/");
  redirect(`/stories/${story.id}?panel=worldBook`);
}

export async function createStoryFromDraftAction(formData: FormData) {
  const story = await createStoryFromDraft({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    importedAssetsJson: String(formData.get("importedAssetsJson") ?? "[]"),
    characterProfilesJson: String(formData.get("characterProfilesJson") ?? "[]"),
    worldEntriesJson: String(formData.get("worldEntriesJson") ?? "[]")
  });

  revalidatePath("/");
  redirect(`/stories/${story.id}?panel=worldBook`);
}

export async function updateStoryAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await updateStory({
    storyId,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? "")
  });

  revalidatePath("/");
  revalidatePath(`/stories/${storyId}`);
}

export async function parseSillyTavernStoryDraftAction(
  _previousState: unknown,
  formData: FormData
) {
  try {
    const draft = parseSillyTavernStoryDraft({
      sourceType: String(formData.get("sourceType") ?? "character_card") as
        | "character_card"
        | "world_lorebook",
      jsonText: String(formData.get("jsonText") ?? ""),
      originalFilename: String(formData.get("originalFilename") ?? "")
    });

    return {
      ok: true,
      error: "",
      draft
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "导入内容无法解析",
      draft: null
    };
  }
}
