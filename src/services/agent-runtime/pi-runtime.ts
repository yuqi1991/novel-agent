import fs from "node:fs";

import type { AgentRuntime, AgentRuntimeInput } from "./types";
import type { AgentRuntimeConfig } from "./runtime-config";

export class PiAgentRuntime implements AgentRuntime {
  constructor(private readonly config: AgentRuntimeConfig) {}

  async runTurn(input: AgentRuntimeInput) {
    const {
      AuthStorage,
      createAgentSession,
      DefaultResourceLoader,
      getAgentDir,
      ModelRegistry,
      SessionManager,
      SettingsManager
    } = await import("@earendil-works/pi-coding-agent");
    const agentDir = this.config.agentDir ?? getAgentDir();
    const authStorage = AuthStorage.create(this.config.authPath);
    const modelRegistry = ModelRegistry.create(authStorage, this.config.modelsPath);
    const settingsManager = SettingsManager.create(this.config.cwd, agentDir, { projectTrusted: true });
    const model = resolveModel(modelRegistry, input.modelSettings);
    const systemPrompt = readSystemPrompt(input.fileAgent?.systemPromptPath) ?? buildSystemPrompt(input);
    const resourceLoader = new DefaultResourceLoader({
      cwd: this.config.cwd,
      agentDir,
      settingsManager,
      additionalSkillPaths: input.fileAgent?.skillPaths ?? [],
      additionalPromptTemplatePaths: input.fileAgent?.promptPaths ?? [],
      noExtensions: true,
      noThemes: true,
      noContextFiles: true,
      systemPrompt
    });
    await resourceLoader.reload();

    const { session } = await createAgentSession({
      cwd: this.config.cwd,
      agentDir,
      authStorage,
      modelRegistry,
      settingsManager,
      model: model as Parameters<typeof createAgentSession>[0] extends { model?: infer T } ? T : never,
      thinkingLevel: normalizeThinkingLevel(input.modelSettings.thinkingLevel),
      resourceLoader,
      sessionManager: SessionManager.inMemory(this.config.cwd),
      noTools: this.config.noTools ? "all" : undefined
    });

    await runWithTimeout(session.prompt(input.prompt), input.timeoutMs, async () => {
      await session.abort();
    });
    const outputText = session.getLastAssistantText()?.trim();
    if (!outputText) {
      throw new Error("Pi runtime returned an empty assistant response");
    }

    return {
      outputText,
      runtimeName: "pi-agent",
      modelProvider: readModelField(model, "provider"),
      modelName: readModelField(model, "id"),
      metadata: {
        cwd: this.config.cwd,
        noTools: this.config.noTools,
        agentId: input.fileAgent?.id,
        skillPathCount: input.fileAgent?.skillPaths.length ?? 0,
        promptPathCount: input.fileAgent?.promptPaths.length ?? 0
      }
    };
  }
}

function readSystemPrompt(filePath: string | undefined) {
  if (!filePath) {
    return undefined;
  }
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : undefined;
}

function resolveModel(
  modelRegistry: { find(provider: string, modelId: string): unknown },
  modelSettings: AgentRuntimeInput["modelSettings"]
) {
  if (!modelSettings.provider || !modelSettings.model) {
    return undefined;
  }

  const model = modelRegistry.find(modelSettings.provider, modelSettings.model);
  if (!model) {
    throw new Error(`Pi model not found: ${modelSettings.provider}/${modelSettings.model}`);
  }
  return model;
}

function readModelField(model: unknown, field: "provider" | "id") {
  if (!model || typeof model !== "object") {
    return undefined;
  }
  const record = model as Record<string, unknown>;
  return typeof record[field] === "string" ? record[field] : undefined;
}

function normalizeThinkingLevel(value: AgentRuntimeInput["modelSettings"]["thinkingLevel"]) {
  return value && value !== "off" ? value : undefined;
}

function buildSystemPrompt(input: AgentRuntimeInput) {
  return [
    "你是 Novel Agent 的角色扮演正文写作 Agent。",
    "你的任务是根据故事材料、最近对话和玩家最新输入，输出一段自然、连贯、有现场感的中文 RP 回复。",
    "你可以描写环境、NPC 行动、NPC 对白和玩家动作导致的直接反馈。",
    "不要替玩家角色做转折性决定、关键选择或长期承诺。",
    "不要输出分析、JSON、Markdown 标题、系统说明或工具调用说明。",
    "只输出最终给玩家看的正文内容。",
    input.assignment?.instructions ? `\n当前 Agent 额外要求：\n${input.assignment.instructions}` : ""
  ].join("\n");
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => Promise<void>) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          void onTimeout();
          reject(new Error(`Pi runtime timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
