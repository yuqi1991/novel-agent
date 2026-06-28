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
import { getAgentRuntime } from "./agent-runtime";
import type { RuntimeModelSettings } from "./agent-runtime";
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
const defaultAgentName = "莉莉儿 RP Writer";

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
    description: "Minimal one-agent Pi play loop for local MVP sessions.",
    modelDefaultsJson: JSON.stringify({})
  });

  await database.insert(agentAssignments).values({
    id: newId("agent"),
    orchestrationConfigurationId: configurationId,
    orderIndex: 0,
    agentRole: "narrative_writer",
    name: defaultAgentName,
    instructions: "根据故事材料和玩家最新输入，输出自然中文角色扮演正文。",
    skillSetJson: JSON.stringify([]),
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

  const workflowTraceId = newId("trace");
  const assignment = assignments[0] ?? null;
  const capabilities = assignment ? await resolveAgentCapabilities(assignment, database) : null;
  const modelSettings = resolveModelSettings(configuration.modelDefaultsJson, assignment?.modelOverrideJson ?? null);
  const prompt = buildRolePlayPrompt({
    contextPack,
    assignmentInstructions: assignment?.instructions ?? "",
    variantIndex: parsed.variantIndex
  });
  const startedAt = new Date().toISOString();
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

  try {
    const runtimeResult = await getAgentRuntime().runTurn({
      prompt,
      contextPack,
      configuration,
      assignment,
      modelSettings,
      timeoutMs: assignment?.timeoutMs ?? 60_000,
      variantIndex: parsed.variantIndex
    });
    const completedAt = new Date().toISOString();

    await database.insert(workflowTraces).values({
      id: workflowTraceId,
      sessionId: parsed.sessionId,
      orchestrationConfigurationId: configuration.id,
      status: "succeeded",
      startedAt,
      completedAt,
      finalOutputText: runtimeResult.outputText
    });
    await database.insert(workflowTraceSteps).values({
      id: newId("step"),
      workflowTraceId,
      agentAssignmentId: assignment?.id ?? null,
      orderIndex: assignment?.orderIndex ?? 0,
      inputPayloadJson: JSON.stringify(buildTraceInputPayload({
        parsed,
        contextPack,
        prompt,
        modelSettings,
        runtimeName: runtimeResult.runtimeName
      })),
      outputText: runtimeResult.outputText,
      subagentResultsJson: JSON.stringify(subagentResults),
      startedAt,
      completedAt,
      status: "succeeded"
    });

    return {
      workflowTraceId,
      orchestrationConfigurationId: configuration.id,
      narrativeResponseText: runtimeResult.outputText
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const errorJson = JSON.stringify(normalizeError(error));
    await database.insert(workflowTraces).values({
      id: workflowTraceId,
      sessionId: parsed.sessionId,
      orchestrationConfigurationId: configuration.id,
      status: "failed",
      startedAt,
      completedAt,
      errorJson
    });
    await database.insert(workflowTraceSteps).values({
      id: newId("step"),
      workflowTraceId,
      agentAssignmentId: assignment?.id ?? null,
      orderIndex: assignment?.orderIndex ?? 0,
      inputPayloadJson: JSON.stringify(buildTraceInputPayload({
        parsed,
        contextPack,
        prompt,
        modelSettings,
        runtimeName: "pi-agent"
      })),
      subagentResultsJson: JSON.stringify(subagentResults),
      startedAt,
      completedAt,
      status: "failed",
      errorJson
    });
    throw error;
  }
}

function resolveModelSettings(defaultsJson: string, overrideJson: string | null): RuntimeModelSettings {
  return {
    ...parseJsonObject(defaultsJson),
    ...(overrideJson ? parseJsonObject(overrideJson) : {})
  };
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function buildRolePlayPrompt({
  contextPack,
  assignmentInstructions,
  variantIndex
}: {
  contextPack: Awaited<ReturnType<typeof assembleContextPack>>;
  assignmentInstructions: string;
  variantIndex: number;
}) {
  return [
    "请根据以下材料继续角色扮演故事，只输出给玩家看的正文。",
    variantIndex > 0 ? `这是第 ${variantIndex + 1} 个重掷版本，请避免重复之前的措辞和展开。` : "",
    assignmentInstructions ? `\n[Agent 要求]\n${assignmentInstructions}` : "",
    section("玩家最新输入", contextPack.playerMessage),
    section("最近对话", formatRecentConversation(contextPack.recentConversation)),
    section("故事固定背景", contextPack.storyMaterial.fixedContextText),
    section("角色资料", formatCharacters(contextPack.storyMaterial.characters, contextPack.storyMaterial.playerCharacter)),
    section("命中的世界书", formatWorldEntries(contextPack.worldEntries)),
    section("Progress Wiki", formatProgressWiki(contextPack.progressWiki)),
    [
      "[输出要求]",
      "- 使用自然中文。",
      "- 可以描写环境、NPC 行动、NPC 对白和玩家输入造成的直接反馈。",
      "- 不要替玩家角色做关键决定、转折选择或长期承诺。",
      "- 不要输出分析、JSON、标题、系统提示或解释。"
    ].join("\n")
  ].filter(Boolean).join("\n\n");
}

function section(title: string, body: string) {
  const trimmed = body.trim();
  return trimmed ? `[${title}]\n${trimmed}` : "";
}

function formatRecentConversation(items: Awaited<ReturnType<typeof assembleContextPack>>["recentConversation"]) {
  return items
    .map((item) => `${item.positionIndex}. ${item.role === "player" ? "玩家" : "系统"}：${item.text}`)
    .join("\n");
}

function formatCharacters(
  characters: Awaited<ReturnType<typeof assembleContextPack>>["storyMaterial"]["characters"],
  playerCharacter: Awaited<ReturnType<typeof assembleContextPack>>["storyMaterial"]["playerCharacter"]
) {
  return characters
    .map((character) => {
      const tags = [
        character.role === "player" ? "玩家角色" : null,
        playerCharacter?.id === character.id ? "当前玩家角色" : null
      ].filter(Boolean).join("，");
      return `- ${character.name}${tags ? `（${tags}）` : ""}\n${character.profileText}`;
    })
    .join("\n\n");
}

function formatWorldEntries(entries: Awaited<ReturnType<typeof assembleContextPack>>["worldEntries"]) {
  return entries.map((entry) => `- ${entry.title}（${entry.reason}）\n${entry.body}`).join("\n\n");
}

function formatProgressWiki(documents: Awaited<ReturnType<typeof assembleContextPack>>["progressWiki"]) {
  return documents.map((document) => `- ${document.title}\n${document.body}`).join("\n\n");
}

function buildTraceInputPayload({
  parsed,
  contextPack,
  prompt,
  modelSettings,
  runtimeName
}: {
  parsed: z.infer<typeof runGenerationWorkflowInput>;
  contextPack: Awaited<ReturnType<typeof assembleContextPack>>;
  prompt: string;
  modelSettings: RuntimeModelSettings;
  runtimeName: string;
}) {
  return {
    runtimeName,
    modelSettings,
    playerMessage: parsed.playerMessage,
    variantIndex: parsed.variantIndex,
    prompt,
    contextPack,
    storyMaterial: {
      fixedContextIncluded: Boolean(contextPack.storyMaterial.fixedContextText),
      characterCount: contextPack.storyMaterial.characters.length,
      playerCharacterIncluded: Boolean(contextPack.storyMaterial.playerCharacter),
      worldEntryCount: contextPack.worldEntries.length,
      progressWikiDocumentCount: contextPack.progressWiki.length,
      recentConversationCount: contextPack.recentConversation.length
    }
  };
}

function normalizeError(error: unknown) {
  return {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "Error"
  };
}
