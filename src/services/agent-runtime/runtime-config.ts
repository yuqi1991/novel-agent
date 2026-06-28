import fs from "node:fs";
import path from "node:path";

export type UserDataAgentConfig = {
  id: string;
  name: string;
  role: string;
  instructions?: string;
  model?: {
    provider?: string;
    model?: string;
    thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  };
  timeoutMs?: number;
  skills: string[];
  allowedTools: string[];
  systemPromptPath?: string;
  skillPaths: string[];
  promptPaths: string[];
};

export type UserDataWorkflowConfig = {
  id: string;
  type: "linear";
  agents: string[];
};

export type AgentRuntimeConfig = {
  runtime: "pi" | "stub";
  userDataDir: string;
  cwd: string;
  agentDir: string;
  authPath: string;
  modelsPath: string;
  noTools: boolean;
  defaultWorkflowId: string;
  defaultProvider?: string;
  defaultModel?: string;
  agents: Record<string, UserDataAgentConfig>;
  workflows: Record<string, UserDataWorkflowConfig>;
};

type RawYaml = Record<string, unknown>;

const defaultWorkflowId = "default_play";
const defaultPlannerAgentId = "plot-designer";
const defaultWriterAgentId = "literary-writer";

export function loadAgentRuntimeConfig(): AgentRuntimeConfig {
  const userDataDir = resolveConfigPath(process.env.NOVEL_AGENT_USER_DATA_DIR || "user_data");
  ensureDefaultUserDataLayout(userDataDir);
  const yaml = readYamlFile(path.join(userDataDir, "config.yaml"));
  const runtime = getRuntime(readString(yaml.runtime));
  const providers = readRecord(yaml.providers);
  const providerDefaults = readRecord(providers.defaults);
  const piConfig = readRecord(yaml.pi);
  const workflows = loadWorkflowConfigs(readRecord(yaml.workflows));
  const agents = loadAgentConfigs(userDataDir);

  return {
    runtime,
    userDataDir,
    cwd: resolveConfigPath(
      process.env.NOVEL_AGENT_PI_CWD || readString(yaml.cwd) || userDataDir
    ),
    agentDir: resolveConfigPath(
      process.env.NOVEL_AGENT_PI_AGENT_DIR || readString(piConfig.agentDir) || userDataDir
    ),
    authPath: resolveConfigPath(
      process.env.NOVEL_AGENT_PI_AUTH_PATH || readString(piConfig.authPath) || "providers/auth.json",
      userDataDir
    ),
    modelsPath: resolveConfigPath(
      process.env.NOVEL_AGENT_PI_MODELS_PATH || readString(piConfig.modelsPath) || "providers/models.json",
      userDataDir
    ),
    noTools: getBoolean(process.env.NOVEL_AGENT_PI_NO_TOOLS, readBoolean(piConfig.noTools, true)),
    defaultWorkflowId: readString(yaml.defaultWorkflow) || defaultWorkflowId,
    defaultProvider: readString(providerDefaults.provider) || undefined,
    defaultModel: readString(providerDefaults.model) || undefined,
    agents,
    workflows
  };
}

export function getWorkflowAgents(config: AgentRuntimeConfig, workflowId = config.defaultWorkflowId) {
  const workflow = config.workflows[workflowId] ?? config.workflows[defaultWorkflowId];
  return (workflow?.agents ?? [])
    .map((agentId) => config.agents[agentId])
    .filter((agent): agent is UserDataAgentConfig => Boolean(agent));
}

function getRuntime(fileRuntime?: string) {
  const value = process.env.NOVEL_AGENT_RUNTIME || fileRuntime || (process.env.NODE_ENV === "test" ? "stub" : "pi");
  return value === "stub" ? "stub" : "pi";
}

function loadWorkflowConfigs(rawWorkflows: RawYaml) {
  const workflows: Record<string, UserDataWorkflowConfig> = {};
  for (const [id, raw] of Object.entries(rawWorkflows)) {
    const workflow = readRecord(raw);
    workflows[id] = {
      id,
      type: readString(workflow.type) === "linear" ? "linear" : "linear",
      agents: readStringArray(workflow.agents)
    };
  }

  if (!workflows[defaultWorkflowId]) {
    workflows[defaultWorkflowId] = {
      id: defaultWorkflowId,
      type: "linear",
      agents: [defaultPlannerAgentId, defaultWriterAgentId]
    };
  }
  return workflows;
}

function loadAgentConfigs(userDataDir: string) {
  const agentsDir = path.join(userDataDir, "agents");
  const agents: Record<string, UserDataAgentConfig> = {};
  if (!fs.existsSync(agentsDir)) {
    return agents;
  }

  for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const agentRoot = path.join(agentsDir, entry.name);
    const raw = readYamlFile(path.join(agentRoot, "agent.yaml"));
    const id = readString(raw.id) || entry.name;
    const model = readRecord(raw.model);
    agents[id] = {
      id,
      name: readString(raw.name) || id,
      role: readString(raw.role) || "agent",
      instructions: readString(raw.instructions) || undefined,
      model: {
        provider: readString(model.provider) || undefined,
        model: readString(model.model) || undefined,
        thinkingLevel: readThinkingLevel(model.thinkingLevel)
      },
      timeoutMs: readNumber(raw.timeout_ms) ?? readNumber(raw.timeoutMs),
      skills: readStringArray(raw.skills),
      allowedTools: readStringArray(raw.allowed_tools).length > 0
        ? readStringArray(raw.allowed_tools)
        : readStringArray(raw.allowedTools),
      systemPromptPath: optionalExistingPath(agentRoot, readString(raw.system_prompt_file) || "system.md"),
      skillPaths: readPathArray(agentRoot, raw.skill_dirs, ["skills"]),
      promptPaths: readPathArray(agentRoot, raw.prompt_dirs, ["prompts"])
    };
  }

  return agents;
}

function ensureDefaultUserDataLayout(userDataDir: string) {
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(path.join(userDataDir, "providers"), { recursive: true });
  fs.mkdirSync(path.join(userDataDir, "stories"), { recursive: true });
  fs.mkdirSync(path.join(userDataDir, "lorebooks"), { recursive: true });
  ensureFile(path.join(userDataDir, "providers", "auth.json"), "{}\n");
  ensureFile(path.join(userDataDir, "providers", "models.json"), defaultModelsJson());
  ensureFile(path.join(userDataDir, "config.yaml"), defaultConfigYaml());
  ensureDefaultAgent(userDataDir, defaultPlannerAgentId, {
    name: "剧情设计师",
    role: "plot_designer",
    instructions: "先分析当前局面，设计下一轮剧情推进方向。输出只给下游写手使用，不要直接面向玩家。",
    system: [
      "你是中文角色扮演游戏的剧情设计师。",
      "你的任务是根据故事材料、最近对话和玩家最新输入，规划下一轮剧情节拍。",
      "不要写最终正文，只输出简明的剧情计划、冲突、NPC 意图和需要避免的越权玩家决定。"
    ].join("\n")
  });
  ensureDefaultAgent(userDataDir, defaultWriterAgentId, {
    name: "文学写手",
    role: "literary_writer",
    instructions: "根据剧情设计师的计划写成最终给玩家看的中文 RP 正文。",
    system: [
      "你是中文角色扮演游戏的文学写手。",
      "你的任务是把上游剧情计划写成自然、连贯、有现场感的最终正文。",
      "保持角色口吻，不替玩家做关键决定，不输出分析、标题、JSON 或系统说明。"
    ].join("\n")
  });
}

function ensureDefaultAgent(
  userDataDir: string,
  id: string,
  values: { name: string; role: string; instructions: string; system: string }
) {
  const agentRoot = path.join(userDataDir, "agents", id);
  const skillsRoot = path.join(agentRoot, "skills");
  const skillId = defaultSkillIdForAgent(id);
  fs.mkdirSync(skillsRoot, { recursive: true });
  fs.mkdirSync(path.join(agentRoot, "prompts"), { recursive: true });
  ensureSkillSkeleton(skillsRoot, id);
  ensureFile(path.join(agentRoot, "system.md"), `${values.system}\n`);
  ensureFile(
    path.join(agentRoot, "agent.yaml"),
    [
      `id: ${id}`,
      `name: ${values.name}`,
      `role: ${values.role}`,
      "model:",
      "  provider:",
      "  model:",
      "timeout_ms: 90000",
      "skills:",
      `  - ${skillId}`,
      "allowed_tools: []",
      "system_prompt_file: system.md",
      "prompt_dirs:",
      "  - prompts",
      "skill_dirs:",
      "  - skills",
      "instructions: |",
      ...values.instructions.split("\n").map((line) => `  ${line}`),
      ""
    ].join("\n")
  );
}

function ensureSkillSkeleton(skillsRoot: string, agentId: string) {
  const skillId = defaultSkillIdForAgent(agentId);
  const skillRoot = path.join(skillsRoot, skillId);
  fs.mkdirSync(skillRoot, { recursive: true });
  ensureFile(
    path.join(skillRoot, "SKILL.md"),
    [
      "---",
      `name: ${skillId}`,
      `description: ${agentId === defaultPlannerAgentId ? "Plan the next role-play story beat from context." : "Write the final Chinese role-play prose response from a plan."}`,
      "---",
      "",
      agentId === defaultPlannerAgentId
        ? "Use the current story context to produce a concise next-beat plan for the downstream prose writer."
        : "Turn upstream planning notes into immersive Chinese role-play prose for the player.",
      ""
    ].join("\n")
  );
}

function defaultSkillIdForAgent(agentId: string) {
  return agentId === defaultPlannerAgentId ? "plot-planning" : "rp-prose-writing";
}

function ensureFile(filePath: string, content: string) {
  if (fs.existsSync(filePath)) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function defaultConfigYaml() {
  return [
    "runtime: pi",
    "cwd: .",
    "defaultWorkflow: default_play",
    "providers:",
    "  defaults:",
    "    provider: deepseek",
    "    model: deepseek-v4-flash",
    "pi:",
    "  agentDir: .",
    "  authPath: providers/auth.json",
    "  modelsPath: providers/models.json",
    "  noTools: true",
    "workflows:",
    "  default_play:",
    "    type: linear",
    "    agents:",
    "      - plot-designer",
    "      - literary-writer",
    ""
  ].join("\n");
}

function defaultModelsJson() {
  return `${JSON.stringify({
    providers: {
      deepseek: {
        baseUrl: "https://api.deepseek.com/v1",
        api: "openai-completions",
        authHeader: true,
        compat: {
          supportsDeveloperRole: false,
          supportsReasoningEffort: false
        },
        models: [
          {
            id: "deepseek-v4-flash",
            name: "DeepSeek V4 Flash",
            reasoning: false,
            input: ["text"],
            contextWindow: 128000,
            maxTokens: 8192,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0
            }
          }
        ]
      }
    }
  }, null, 2)}\n`;
}

function readPathArray(basePath: string, value: unknown, fallback: string[]) {
  const paths = readStringArray(value).length > 0 ? readStringArray(value) : fallback;
  return paths.map((item) => resolveConfigPath(item, basePath));
}

function optionalExistingPath(basePath: string, value: string) {
  const resolved = resolveConfigPath(value, basePath);
  return fs.existsSync(resolved) ? resolved : undefined;
}

function readYamlFile(filePath: string): RawYaml {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return parseSimpleYaml(fs.readFileSync(filePath, "utf8"));
}

function parseSimpleYaml(content: string): RawYaml {
  const root: RawYaml = {};
  const stack: Array<{ indent: number; value: RawYaml | string[] }> = [{ indent: -1, value: root }];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) {
      continue;
    }
    const indent = rawLine.match(/^ */)?.[0].length ?? 0;
    const line = rawLine.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].value;

    if (line.startsWith("- ")) {
      if (!Array.isArray(parent)) {
        continue;
      }
      parent.push(String(parseScalar(line.slice(2).trim())));
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0 || Array.isArray(parent)) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const valueText = line.slice(separatorIndex + 1).trim();
    if (valueText === "|") {
      const blockLines: string[] = [];
      const blockIndent = getNextContentIndent(lines, index + 1, indent);
      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1];
        const nextIndent = nextLine.match(/^ */)?.[0].length ?? 0;
        if (nextLine.trim() && nextIndent <= indent) {
          break;
        }
        index += 1;
        blockLines.push(nextLine.slice(Math.min(blockIndent, nextLine.length)));
      }
      parent[key] = blockLines.join("\n").trimEnd();
      continue;
    }

    if (valueText) {
      parent[key] = parseScalar(valueText);
      continue;
    }

    const nextMeaningfulLine = lines.slice(index + 1).find((candidate) => candidate.trim() && !candidate.trimStart().startsWith("#"));
    const child: RawYaml | string[] = nextMeaningfulLine?.trim().startsWith("- ") ? [] : {};
    parent[key] = child;
    stack.push({ indent, value: child });
  }

  return root;
}

function getNextContentIndent(lines: string[], startIndex: number, fallback: number) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim()) {
      return line.match(/^ */)?.[0].length ?? fallback + 2;
    }
  }
  return fallback + 2;
}

function parseScalar(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "[]") {
    return [];
  }
  const numberValue = Number(trimmed);
  return Number.isFinite(numberValue) && /^-?\d+(\.\d+)?$/.test(trimmed) ? numberValue : trimmed;
}

function readRecord(value: unknown): RawYaml {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawYaml) : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(readString).filter(Boolean) : [];
}

function readThinkingLevel(value: unknown): NonNullable<UserDataAgentConfig["model"]>["thinkingLevel"] {
  const level = readString(value);
  return ["off", "minimal", "low", "medium", "high", "xhigh"].includes(level)
    ? (level as NonNullable<UserDataAgentConfig["model"]>["thinkingLevel"])
    : undefined;
}

function getBoolean(envValue: string | undefined, fallback: boolean) {
  if (envValue === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(envValue.toLowerCase());
}

function resolveConfigPath(value: string, basePath = path.join(/*turbopackIgnore: true*/ process.cwd(), ".")) {
  const expanded = value === "~" || value.startsWith(`~${path.sep}`)
    ? path.join(process.env.HOME ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "."), value.slice(2))
    : value;
  return path.isAbsolute(expanded) ? expanded : path.join(basePath, expanded);
}
