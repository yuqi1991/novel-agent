"use server";

import { revalidatePath } from "next/cache";
import {
  createProgressWikiDocument,
  createWikiSnapshot,
  deleteProgressWikiDocument,
  updateProgressWikiDocument
} from "@/services/progress-wiki-service";

function revalidateStory(storyId: string) {
  revalidatePath(`/stories/${storyId}`);
}

export async function createProgressWikiDocumentAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await createProgressWikiDocument({
    sessionId: String(formData.get("sessionId") ?? ""),
    title: String(formData.get("title") ?? ""),
    documentType: String(formData.get("documentType") ?? "note"),
    body: String(formData.get("body") ?? ""),
    tagsJson: String(formData.get("tagsJson") ?? "[]")
  });

  revalidateStory(storyId);
}

export async function updateProgressWikiDocumentAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await updateProgressWikiDocument({
    sessionId: String(formData.get("sessionId") ?? ""),
    documentId: String(formData.get("documentId") ?? ""),
    title: String(formData.get("title") ?? ""),
    documentType: String(formData.get("documentType") ?? "note"),
    body: String(formData.get("body") ?? ""),
    tagsJson: String(formData.get("tagsJson") ?? "[]")
  });

  revalidateStory(storyId);
}

export async function deleteProgressWikiDocumentAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await deleteProgressWikiDocument({
    sessionId: String(formData.get("sessionId") ?? ""),
    documentId: String(formData.get("documentId") ?? "")
  });

  revalidateStory(storyId);
}

export async function createWikiSnapshotAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await createWikiSnapshot({
    sessionId: String(formData.get("sessionId") ?? ""),
    memoryBoundaryPosition: String(formData.get("memoryBoundaryPosition") ?? "")
  });

  revalidateStory(storyId);
}
