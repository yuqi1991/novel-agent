"use server";

import { revalidatePath } from "next/cache";
import {
  createAgentProfile,
  deleteAgentProfile,
  updateAgentProfile
} from "@/services/agent-profile-service";

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function revalidateStory(storyId: string) {
  if (storyId) {
    revalidatePath(`/stories/${storyId}`);
  }
  revalidatePath("/");
}

export async function createAgentProfileAction(formData: FormData) {
  const storyId = getFormString(formData, "storyId");
  await createAgentProfile({
    name: getFormString(formData, "name"),
    agentRole: getFormString(formData, "agentRole"),
    description: getFormString(formData, "description"),
    instructions: getFormString(formData, "instructions"),
    skillSetJson: getFormString(formData, "skillSetJson") || "[]",
    modelOverrideJson: getFormString(formData, "modelOverrideJson"),
    allowedToolsJson: getFormString(formData, "allowedToolsJson") || "[]",
    timeoutMs: getFormString(formData, "timeoutMs") || "60000"
  });
  revalidateStory(storyId);
}

export async function updateAgentProfileAction(formData: FormData) {
  const storyId = getFormString(formData, "storyId");
  await updateAgentProfile({
    profileId: getFormString(formData, "profileId"),
    name: getFormString(formData, "name"),
    agentRole: getFormString(formData, "agentRole"),
    description: getFormString(formData, "description"),
    instructions: getFormString(formData, "instructions"),
    skillSetJson: getFormString(formData, "skillSetJson") || "[]",
    modelOverrideJson: getFormString(formData, "modelOverrideJson"),
    allowedToolsJson: getFormString(formData, "allowedToolsJson") || "[]",
    timeoutMs: getFormString(formData, "timeoutMs") || "60000"
  });
  revalidateStory(storyId);
}

export async function deleteAgentProfileAction(formData: FormData) {
  const storyId = getFormString(formData, "storyId");
  await deleteAgentProfile({ profileId: getFormString(formData, "profileId") });
  revalidateStory(storyId);
}
