"use server";

import { revalidatePath } from "next/cache";
import {
  createAgentAssignment,
  createAgentAssignmentFromProfile,
  createOrchestrationConfiguration,
  deleteAgentAssignment,
  deleteOrchestrationConfiguration
} from "@/services/orchestration-config-service";

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function revalidateStory(storyId: string) {
  if (storyId) {
    revalidatePath(`/stories/${storyId}`);
  }
}

export async function createOrchestrationConfigurationAction(formData: FormData) {
  const storyId = getFormString(formData, "storyId");
  await createOrchestrationConfiguration({
    name: getFormString(formData, "name"),
    description: getFormString(formData, "description"),
    modelDefaultsJson: getFormString(formData, "modelDefaultsJson") || "{}"
  });
  revalidateStory(storyId);
}

export async function deleteOrchestrationConfigurationAction(formData: FormData) {
  const storyId = getFormString(formData, "storyId");
  await deleteOrchestrationConfiguration({ configurationId: getFormString(formData, "configurationId") });
  revalidateStory(storyId);
}

export async function createAgentAssignmentAction(formData: FormData) {
  const storyId = getFormString(formData, "storyId");
  await createAgentAssignment({
    configurationId: getFormString(formData, "configurationId"),
    name: getFormString(formData, "name"),
    agentRole: getFormString(formData, "agentRole"),
    instructions: getFormString(formData, "instructions"),
    skillSetJson: getFormString(formData, "skillSetJson") || "[]",
    modelOverrideJson: getFormString(formData, "modelOverrideJson"),
    allowedToolsJson: getFormString(formData, "allowedToolsJson") || "[]",
    timeoutMs: getFormString(formData, "timeoutMs") || "60000"
  });
  revalidateStory(storyId);
}

export async function createAgentAssignmentFromProfileAction(formData: FormData) {
  const storyId = getFormString(formData, "storyId");
  await createAgentAssignmentFromProfile({
    configurationId: getFormString(formData, "configurationId"),
    profileId: getFormString(formData, "profileId")
  });
  revalidateStory(storyId);
}

export async function deleteAgentAssignmentAction(formData: FormData) {
  const storyId = getFormString(formData, "storyId");
  await deleteAgentAssignment({
    configurationId: getFormString(formData, "configurationId"),
    assignmentId: getFormString(formData, "assignmentId")
  });
  revalidateStory(storyId);
}
