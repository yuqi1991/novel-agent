"use server";

import { revalidatePath } from "next/cache";
import { importSillyTavernJson } from "@/services/sillytavern-import-service";

function getFormString(formData: FormData, ...names: string[]) {
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

function revalidateStory(storyId: string) {
  revalidatePath(`/stories/${storyId}`);
}

export async function importSillyTavernCharacterAction(formData: FormData) {
  const storyId = getFormString(formData, "storyId");

  await importSillyTavernJson({
    storyId,
    sourceType: "character_card",
    jsonText: getFormString(formData, "jsonText", "payload", "rawPayloadJson"),
    originalFilename: getFormString(formData, "originalFilename", "filename"),
    contentType: getFormString(formData, "contentType")
  });

  revalidateStory(storyId);
}

export async function importSillyTavernWorldAction(formData: FormData) {
  const storyId = getFormString(formData, "storyId");

  await importSillyTavernJson({
    storyId,
    sourceType: "world_lorebook",
    jsonText: getFormString(formData, "jsonText", "payload", "rawPayloadJson"),
    originalFilename: getFormString(formData, "originalFilename", "filename"),
    contentType: getFormString(formData, "contentType")
  });

  revalidateStory(storyId);
}

export const importSillyTavernLorebookAction = importSillyTavernWorldAction;
