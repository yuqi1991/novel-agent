"use server";

import { revalidatePath } from "next/cache";
import {
  createCharacterProfile,
  createWorldEntry,
  deleteCharacterProfile,
  deleteWorldEntry,
  updatePlayerCharacter
} from "@/services/story-material-service";

function revalidateStory(storyId: string) {
  revalidatePath(`/stories/${storyId}`);
}

export async function createCharacterProfileAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await createCharacterProfile({
    storyId,
    name: String(formData.get("name") ?? ""),
    role: String(formData.get("role") ?? ""),
    profileText: String(formData.get("profileText") ?? "")
  });

  revalidateStory(storyId);
}

export async function deleteCharacterProfileAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");

  await deleteCharacterProfile({
    storyId,
    profileId: String(formData.get("characterProfileId") ?? formData.get("profileId") ?? "")
  });

  revalidateStory(storyId);
}

export async function createWorldEntryAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await createWorldEntry({
    storyId,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    inclusionMode: String(formData.get("inclusionMode") ?? "")
  });

  revalidateStory(storyId);
}

export async function deleteWorldEntryAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");

  await deleteWorldEntry({
    storyId,
    worldEntryId: String(formData.get("worldEntryId") ?? "")
  });

  revalidateStory(storyId);
}

export async function updatePlayerCharacterAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await updatePlayerCharacter({
    storyId,
    playerCharacterProfileId: String(formData.get("playerCharacterProfileId") ?? "")
  });

  revalidateStory(storyId);
}

export const setPlayerCharacterAction = updatePlayerCharacterAction;
