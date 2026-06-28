"use server";

import { revalidatePath } from "next/cache";
import {
  createPlaySession,
  forkPlaySession,
  rerollLatestReplyVariant,
  selectReplyVariant,
  submitPlayerMessage
} from "@/services/session-service";

function revalidateStory(storyId: string) {
  revalidatePath(`/stories/${storyId}`);
}

export async function createPlaySessionAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await createPlaySession({
    storyId,
    title: String(formData.get("title") ?? "")
  });

  revalidateStory(storyId);
}

export async function submitPlayerMessageAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await submitPlayerMessage({
    storyId,
    sessionId: String(formData.get("sessionId") ?? ""),
    messageText: String(formData.get("messageText") ?? "")
  });

  revalidateStory(storyId);
}

export async function rerollLatestReplyVariantAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await rerollLatestReplyVariant({
    storyId,
    sessionId: String(formData.get("sessionId") ?? "")
  });

  revalidateStory(storyId);
}

export async function selectReplyVariantAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await selectReplyVariant({
    storyId,
    sessionId: String(formData.get("sessionId") ?? ""),
    conversationPositionId: String(formData.get("conversationPositionId") ?? ""),
    replyVariantId: String(formData.get("replyVariantId") ?? "")
  });

  revalidateStory(storyId);
}

export async function forkPlaySessionAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await forkPlaySession({
    storyId,
    sourceSessionId: String(formData.get("sourceSessionId") ?? ""),
    forkPositionId: String(formData.get("forkPositionId") ?? ""),
    replyVariantId: String(formData.get("replyVariantId") ?? ""),
    title: String(formData.get("title") ?? "")
  });

  revalidateStory(storyId);
}
