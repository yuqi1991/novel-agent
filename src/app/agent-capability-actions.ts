"use server";

import { revalidatePath } from "next/cache";
import { createExternalToolConfiguration } from "@/services/agent-capability-service";

function revalidateStory(storyId: string) {
  if (storyId) {
    revalidatePath(`/stories/${storyId}`);
  }
}

export async function createExternalToolConfigurationAction(formData: FormData) {
  const storyId = String(formData.get("storyId") ?? "");
  await createExternalToolConfiguration({
    name: String(formData.get("name") ?? ""),
    providerType: "mcp",
    configJson: String(formData.get("configJson") ?? "{}"),
    enabled: formData.get("enabled") !== null
  });

  revalidateStory(storyId);
}
