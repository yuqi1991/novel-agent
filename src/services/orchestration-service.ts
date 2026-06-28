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
import type { AgentRuntimeResult, AgentRuntimeStepOutput, RuntimeModelSettings } from "./agent-runtime";
import { resolveAgentCapabilities, runReadOnlySubagent } from "./agent-capability-service";
import {
  getWorkflowAgents,
  loadAgentRuntimeConfig,
  type AgentRuntimeConfig,
  type UserDataAgentConfig
} from "./agent-runtime/runtime-config";
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
    description: "Default file-configured play loop. Agent order is loaded from user_data/config.yaml.",
    modelDefaultsJson: JSON.stringify({ provider: "deepseek", model: "deepseek-v4-flash" })
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
  const runtimeConfig = loadAgentRuntimeConfig();
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
  const startedAt = new Date().toISOString();
  const workflowSteps = buildWorkflowSteps({ runtimeConfig, assignments });
  const previousStepOutputs: AgentRuntimeStepOutput[] = [];
  const persistedSteps: Array<{
    assignment: typeof agentAssignments.$inferSelect | null;
    fileAgent?: UserDataAgentConfig;
    prompt: string;
    modelSettings: RuntimeModelSettings;
    runtimeResult: AgentRuntimeResult;
    subagentResults: Awaited<ReturnType<typeof runReadOnlySubagent>>;
    previousStepOutputs: AgentRuntimeStepOutput[];
    startedAt: string;
    completedAt: string;
    orderIndex: number;
  }> = [];

  try {
    for (const [index, step] of workflowSteps.entries()) {
      const stepStartedAt = new Date().toISOString();
      const capabilities = step.assignment ? await resolveAgentCapabilities(step.assignment, database) : null;
      const subagentResults = step.assignment
        ? await runReadOnlySubagent({
            assignmentName: step.assignment.name,
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
      const modelSettings = resolveModelSettings(
        configuration.modelDefaultsJson,
        step.assignment?.modelOverrideJson ?? null,
        runtimeConfig,
        step.fileAgent
      );
      const inputPreviousStepOutputs = [...previousStepOutputs];
      const prompt = buildRolePlayPrompt({
        contextPack,
        assignmentInstructions: step.assignment?.instructions ?? step.fileAgent?.instructions ?? "",
        variantIndex: parsed.variantIndex,
        stepRole: step.fileAgent?.role ?? step.assignment?.agentRole ?? "agent",
        previousStepOutputs: inputPreviousStepOutputs
      });
      const runtimeResult = await getAgentRuntime(runtimeConfig).runTurn({
        prompt,
        contextPack,
        configuration,
        assignment: step.assignment,
        fileAgent: step.fileAgent,
        modelSettings,
        timeoutMs: step.fileAgent?.timeoutMs ?? step.assignment?.timeoutMs ?? 90_000,
        variantIndex: parsed.variantIndex,
        previousStepOutputs: inputPreviousStepOutputs
      });
      const stepCompletedAt = new Date().toISOString();
      const agentName = step.fileAgent?.name ?? step.assignment?.name ?? `Agent ${index + 1}`;
      previousStepOutputs.push({
        agentId: step.fileAgent?.id ?? step.assignment?.id ?? `step-${index + 1}`,
        agentName,
        outputText: runtimeResult.outputText
      });
      persistedSteps.push({
        assignment: step.assignment,
        fileAgent: step.fileAgent,
        prompt,
        modelSettings,
        runtimeResult,
        subagentResults,
        previousStepOutputs: inputPreviousStepOutputs,
        startedAt: stepStartedAt,
        completedAt: stepCompletedAt,
        orderIndex: index
      });
    }

    const finalOutputText = previousStepOutputs.at(-1)?.outputText?.trim();
    if (!finalOutputText) {
      throw new Error("Generation workflow produced no final output");
    }
    const completedAt = new Date().toISOString();

    await database.insert(workflowTraces).values({
      id: workflowTraceId,
      sessionId: parsed.sessionId,
      orchestrationConfigurationId: configuration.id,
      status: "succeeded",
      startedAt,
      completedAt,
      finalOutputText
    });
    await database.insert(workflowTraceSteps).values(
      persistedSteps.map((step) => ({
        id: newId("step"),
        workflowTraceId,
        agentAssignmentId: step.assignment?.id ?? null,
        orderIndex: step.orderIndex,
        inputPayloadJson: JSON.stringify(buildTraceInputPayload({
          parsed,
          contextPack,
          prompt: step.prompt,
          modelSettings: step.modelSettings,
          runtimeName: step.runtimeResult.runtimeName,
          fileAgent: step.fileAgent,
          previousStepOutputs: step.previousStepOutputs
        })),
        outputText: step.runtimeResult.outputText,
        subagentResultsJson: JSON.stringify(step.subagentResults),
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        status: "succeeded" as const
      }))
    );

    return {
      workflowTraceId,
      orchestrationConfigurationId: configuration.id,
      narrativeResponseText: finalOutputText
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
    if (persistedSteps.length > 0) {
      await database.insert(workflowTraceSteps).values(
        persistedSteps.map((step) => ({
          id: newId("step"),
          workflowTraceId,
          agentAssignmentId: step.assignment?.id ?? null,
          orderIndex: step.orderIndex,
          inputPayloadJson: JSON.stringify(buildTraceInputPayload({
            parsed,
            contextPack,
            prompt: step.prompt,
            modelSettings: step.modelSettings,
            runtimeName: step.runtimeResult.runtimeName,
            fileAgent: step.fileAgent,
            previousStepOutputs: step.previousStepOutputs
          })),
          outputText: step.runtimeResult.outputText,
          subagentResultsJson: JSON.stringify(step.subagentResults),
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          status: "succeeded" as const
        }))
      );
    }
    const failedStep = workflowSteps[persistedSteps.length] ?? workflowSteps[0];
    await database.insert(workflowTraceSteps).values({
      id: newId("step"),
      workflowTraceId,
      agentAssignmentId: failedStep?.assignment?.id ?? null,
      orderIndex: persistedSteps.length,
      inputPayloadJson: JSON.stringify({
        playerMessage: parsed.playerMessage,
        variantIndex: parsed.variantIndex,
        fileAgent: failedStep?.fileAgent,
        previousStepOutputs,
        errorStage: "agent_runtime"
      }),
      subagentResultsJson: JSON.stringify([]),
      startedAt: completedAt,
      completedAt,
      status: "failed",
      errorJson
    });
    throw error;
  }
}

function buildWorkflowSteps({
  runtimeConfig,
  assignments
}: {
  runtimeConfig: AgentRuntimeConfig;
  assignments: Array<typeof agentAssignments.$inferSelect>;
}) {
  const fileAgents = getWorkflowAgents(runtimeConfig);
  if (fileAgents.length > 0) {
    return fileAgents.map((fileAgent, index) => ({
      fileAgent,
      assignment: assignments[index] ?? null
    }));
  }

  return assignments.map((assignment) => ({ assignment, fileAgent: undefined }));
}

function resolveModelSettings(
  defaultsJson: string,
  overrideJson: string | null,
  runtimeConfig: AgentRuntimeConfig,
  fileAgent?: UserDataAgentConfig
): RuntimeModelSettings {
  return {
    ...(runtimeConfig.defaultProvider ? { provider: runtimeConfig.defaultProvider } : {}),
    ...(runtimeConfig.defaultModel ? { model: runtimeConfig.defaultModel } : {}),
    ...parseJsonObject(defaultsJson),
    ...(fileAgent?.model?.provider ? { provider: fileAgent.model.provider } : {}),
    ...(fileAgent?.model?.model ? { model: fileAgent.model.model } : {}),
    ...(fileAgent?.model?.thinkingLevel ? { thinkingLevel: fileAgent.model.thinkingLevel } : {}),
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
  variantIndex,
  stepRole,
  previousStepOutputs
}: {
  contextPack: Awaited<ReturnType<typeof assembleContextPack>>;
  assignmentInstructions: string;
  variantIndex: number;
  stepRole: string;
  previousStepOutputs: AgentRuntimeStepOutput[];
}) {
  const isFinalWriter = previousStepOutputs.length > 0;
  return [
    isFinalWriter
      ? "请根据以下材料和上游 Agent 结果，写出最终给玩家看的角色扮演正文。"
      : "请根据以下材料为本轮角色扮演生成你的 Agent 产出。",
    section("当前 Agent 角色", stepRole),
    variantIndex > 0 ? `这是第 ${variantIndex + 1} 个重掷版本，请避免重复之前的措辞和展开。` : "",
    assignmentInstructions ? `\n[Agent 要求]\n${assignmentInstructions}` : "",
    section("上游 Agent 输出", formatPreviousStepOutputs(previousStepOutputs)),
    section("玩家最新输入", contextPack.playerMessage),
    section("最近对话", formatRecentConversation(contextPack.recentConversation)),
    section("故事固定背景", contextPack.storyMaterial.fixedContextText),
    section("角色资料", formatCharacters(contextPack.storyMaterial.characters, contextPack.storyMaterial.playerCharacter)),
    section("命中的世界书", formatWorldEntries(contextPack.worldEntries)),
    section("Progress Wiki", formatProgressWiki(contextPack.progressWiki)),
    [
      "[输出要求]",
      "- 使用自然中文。",
      isFinalWriter
        ? "- 输出最终正文，可以描写环境、NPC 行动、NPC 对白和玩家输入造成的直接反馈。"
        : "- 输出给下游 Agent 使用的工作结果，保持简洁、具体、可执行。",
      "- 不要替玩家角色做关键决定、转折选择或长期承诺。",
      "- 不要输出 JSON、系统提示或工具调用说明。"
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

function formatPreviousStepOutputs(outputs: AgentRuntimeStepOutput[]) {
  return outputs.map((output) => `- ${output.agentName}\n${output.outputText}`).join("\n\n");
}

function buildTraceInputPayload({
  parsed,
  contextPack,
  prompt,
  modelSettings,
  runtimeName,
  fileAgent,
  previousStepOutputs
}: {
  parsed: z.infer<typeof runGenerationWorkflowInput>;
  contextPack: Awaited<ReturnType<typeof assembleContextPack>>;
  prompt: string;
  modelSettings: RuntimeModelSettings;
  runtimeName: string;
  fileAgent?: UserDataAgentConfig;
  previousStepOutputs?: AgentRuntimeStepOutput[];
}) {
  return {
    runtimeName,
    fileAgent,
    modelSettings,
    playerMessage: parsed.playerMessage,
    variantIndex: parsed.variantIndex,
    prompt,
    previousStepOutputs: previousStepOutputs ?? [],
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
