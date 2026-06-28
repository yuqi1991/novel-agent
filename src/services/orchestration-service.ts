import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import {
  agentAssignments,
  orchestrationConfigurations,
  workflowTraces,
  workflowTraceSteps
} from "@/db/schema";
import { newId } from "@/domain/ids";
import { resolveAgentCapabilities, runReadOnlySubagent } from "./agent-capability-service";
import { assembleContextPack } from "./context-assembly-service";

type DbExecutor = Pick<Database, "select" | "insert">;

const idSchema = z.string().trim().min(1, "Id is required");

export const runGenerationWorkflowInput = z.object({
  storyId: idSchema,
  sessionId: idSchema,
  playerMessage: z.string().trim().min(1, "Player message is required").max(20_000),
  variantIndex: z.number().int().min(0).optional().default(0)
});

export type RunGenerationWorkflowInput = z.input<typeof runGenerationWorkflowInput>;

const defaultConfigurationName = "Default Play Loop";
const defaultAgentName = "Narrative Stub";

export async function ensureDefaultOrchestrationConfiguration(database: DbExecutor = db) {
  const [existing] = await database
    .select()
    .from(orchestrationConfigurations)
    .orderBy(asc(orchestrationConfigurations.createdAt), asc(orchestrationConfigurations.name))
    .limit(1);

  if (existing) {
    return existing;
  }

  const configurationId = newId("orch");

  await database.insert(orchestrationConfigurations).values({
    id: configurationId,
    name: defaultConfigurationName,
    description: "Minimal deterministic one-agent play loop for local MVP sessions.",
    modelDefaultsJson: JSON.stringify({ provider: "local-stub", model: "deterministic-narrative-v0" })
  });

  await database.insert(agentAssignments).values({
    id: newId("agent"),
    orchestrationConfigurationId: configurationId,
    orderIndex: 0,
    agentRole: "narrative_writer",
    name: defaultAgentName,
    instructions: "Return one concise Narrative Response using the player message and available Story Material.",
    skillSetJson: JSON.stringify(["deterministic-narrative-stub"]),
    allowedToolsJson: "[]",
    timeoutMs: 60_000
  });

  const [configuration] = await database
    .select()
    .from(orchestrationConfigurations)
    .where(eq(orchestrationConfigurations.id, configurationId))
    .limit(1);

  if (!configuration) {
    throw new Error("Default orchestration configuration was not persisted");
  }
  return configuration;
}

export async function runGenerationWorkflow(input: RunGenerationWorkflowInput, database: DbExecutor = db) {
  const parsed = runGenerationWorkflowInput.parse(input);
  const configuration = await ensureDefaultOrchestrationConfiguration(database);
  const assignments = await database
    .select()
    .from(agentAssignments)
    .where(eq(agentAssignments.orchestrationConfigurationId, configuration.id))
    .orderBy(asc(agentAssignments.orderIndex), asc(agentAssignments.createdAt));
  const contextPack = await assembleContextPack(
    {
      storyId: parsed.storyId,
      sessionId: parsed.sessionId,
      playerMessage: parsed.playerMessage
    },
    database
  );

  const startedAt = new Date().toISOString();
  const responseText = buildDeterministicNarrativeResponse({
    variantIndex: parsed.variantIndex,
    fixedContextText: contextPack.storyMaterial.fixedContextText,
    characterNames: contextPack.storyMaterial.characters.map((profile) => profile.name),
    playerCharacterName: contextPack.storyMaterial.playerCharacter?.name ?? "",
    worldEntryTitles: contextPack.worldEntries.map((entry) => entry.title),
    progressWikiTitles: contextPack.progressWiki.map((document) => document.title)
  });
  const completedAt = new Date().toISOString();
  const workflowTraceId = newId("trace");

  await database.insert(workflowTraces).values({
    id: workflowTraceId,
    sessionId: parsed.sessionId,
    orchestrationConfigurationId: configuration.id,
    status: "succeeded",
    startedAt,
    completedAt,
    finalOutputText: responseText
  });

  const assignment = assignments[0] ?? null;
  const capabilities = assignment ? await resolveAgentCapabilities(assignment, database) : null;
  const subagentResults = assignment
    ? await runReadOnlySubagent({
        assignmentName: assignment.name,
        capabilities: capabilities ?? {
          skillSet: [],
          allowedTools: [],
          externalTools: [],
          canUseProgressWikiSkill: false,
          canSpawnSubagents: false
        },
        contextSummary: `${contextPack.recentConversation.length} recent items, ${contextPack.worldEntries.length} world entries, ${contextPack.progressWiki.length} wiki documents`
      })
    : [];
  await database.insert(workflowTraceSteps).values({
    id: newId("step"),
    workflowTraceId,
    agentAssignmentId: assignment?.id ?? null,
    orderIndex: assignment?.orderIndex ?? 0,
    inputPayloadJson: JSON.stringify({
      playerMessage: parsed.playerMessage,
      variantIndex: parsed.variantIndex,
      contextPack,
      storyMaterial: {
        fixedContextIncluded: Boolean(contextPack.storyMaterial.fixedContextText),
        characterCount: contextPack.storyMaterial.characters.length,
        playerCharacterIncluded: Boolean(contextPack.storyMaterial.playerCharacter),
        worldEntryCount: contextPack.worldEntries.length,
        progressWikiDocumentCount: contextPack.progressWiki.length,
        recentConversationCount: contextPack.recentConversation.length
      }
    }),
    outputText: responseText,
    subagentResultsJson: JSON.stringify(subagentResults),
    startedAt,
    completedAt,
    status: "succeeded"
  });

  return {
    workflowTraceId,
    orchestrationConfigurationId: configuration.id,
    narrativeResponseText: responseText
  };
}

function buildDeterministicNarrativeResponse({
  variantIndex,
  fixedContextText,
  characterNames,
  playerCharacterName,
  worldEntryTitles,
  progressWikiTitles
}: {
  variantIndex: number;
  fixedContextText: string;
  characterNames: string[];
  playerCharacterName: string;
  worldEntryTitles: string[];
  progressWikiTitles: string[];
}) {
  const materialParts = [
    fixedContextText.trim() ? `context: ${compact(fixedContextText)}` : null,
    characterNames.length > 0 ? `characters: ${characterNames.slice(0, 3).join(", ")}` : null,
    playerCharacterName ? `player: ${playerCharacterName}` : null,
    worldEntryTitles.length > 0 ? `world: ${worldEntryTitles.slice(0, 3).join(", ")}` : null,
    progressWikiTitles.length > 0 ? `wiki: ${progressWikiTitles.slice(0, 3).join(", ")}` : null
  ].filter((part): part is string => Boolean(part));
  const materialSummary = materialParts.length > 0 ? materialParts.join("; ") : "no story material yet";

  const variantPrefix = variantIndex > 0 ? `Alternative ${variantIndex + 1}: ` : "";

  return `Narrative Response: ${variantPrefix}The story answers your latest move with ${materialSummary}. The scene advances in direct response to the player's choice.`;
}

function compact(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 240);
}
