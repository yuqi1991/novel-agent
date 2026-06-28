import path from "node:path";
import { createRequire } from "node:module";

const runtimeRequire = createRequire(import.meta.url);

export type AgentRuntimeConfig = {
  runtime: "pi" | "stub";
  cwd: string;
  agentDir?: string;
  authPath?: string;
  modelsPath?: string;
  skillPaths: string[];
  promptPaths: string[];
  noTools: boolean;
};

type ConfigFile = Partial<Omit<AgentRuntimeConfig, "runtime" | "cwd" | "skillPaths" | "promptPaths" | "noTools">> & {
  runtime?: "pi" | "stub";
  cwd?: string;
  skillPaths?: string[];
  promptPaths?: string[];
  noTools?: boolean;
};

export function loadAgentRuntimeConfig(): AgentRuntimeConfig {
  const fileConfig = readConfigFile();
  return {
    runtime: getRuntime(fileConfig.runtime),
    cwd: resolveConfigPath(process.env.NOVEL_AGENT_PI_CWD || fileConfig.cwd || process.cwd()),
    agentDir: resolveOptionalConfigPath(process.env.NOVEL_AGENT_PI_AGENT_DIR || fileConfig.agentDir),
    authPath: resolveOptionalConfigPath(process.env.NOVEL_AGENT_PI_AUTH_PATH || fileConfig.authPath),
    modelsPath: resolveOptionalConfigPath(process.env.NOVEL_AGENT_PI_MODELS_PATH || fileConfig.modelsPath),
    skillPaths: getPathList(process.env.NOVEL_AGENT_PI_SKILL_PATHS, fileConfig.skillPaths).map(resolveConfigPath),
    promptPaths: getPathList(process.env.NOVEL_AGENT_PI_PROMPT_PATHS, fileConfig.promptPaths).map(resolveConfigPath),
    noTools: getBoolean(process.env.NOVEL_AGENT_PI_NO_TOOLS, fileConfig.noTools ?? true)
  };
}

function getRuntime(fileRuntime?: "pi" | "stub") {
  const value = process.env.NOVEL_AGENT_RUNTIME || fileRuntime || (process.env.NODE_ENV === "test" ? "stub" : "pi");
  return value === "stub" ? "stub" : "pi";
}

function readConfigFile(): ConfigFile {
  const fs = runtimeRequire("node:fs") as typeof import("node:fs");
  const configPath = path.join(/* turbopackIgnore: true */ process.cwd(), "config", "agent-runtime.json");
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as ConfigFile) : {};
  } catch {
    return {};
  }
}

function getPathList(envValue: string | undefined, fileValue: string[] | undefined) {
  if (envValue) {
    return envValue.split(path.delimiter).map((item) => item.trim()).filter(Boolean);
  }
  return Array.isArray(fileValue) ? fileValue.filter((item): item is string => typeof item === "string") : [];
}

function getBoolean(envValue: string | undefined, fallback: boolean) {
  if (envValue === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(envValue.toLowerCase());
}

function resolveOptionalConfigPath(value: string | undefined) {
  return value ? resolveConfigPath(value) : undefined;
}

function resolveConfigPath(value: string) {
  const expanded = value === "~" || value.startsWith(`~${path.sep}`)
    ? path.join(process.env.HOME ?? process.cwd(), value.slice(2))
    : value;
  return path.isAbsolute(expanded) ? expanded : path.resolve(process.cwd(), expanded);
}
