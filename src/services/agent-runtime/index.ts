import { DeterministicAgentRuntime } from "./stub-runtime";
import type { AgentRuntimeConfig } from "./runtime-config";
import type { AgentRuntime } from "./types";

let runtimeOverride: AgentRuntime | null = null;

export function getAgentRuntime(config?: AgentRuntimeConfig) {
  if (runtimeOverride) {
    return runtimeOverride;
  }

  const forcedRuntime = process.env.NOVEL_AGENT_RUNTIME || (process.env.NODE_ENV === "test" ? "stub" : "");
  if (forcedRuntime === "stub") {
    return new DeterministicAgentRuntime();
  }

  return {
    async runTurn(input) {
      const runtimeConfig = config ?? (await import("./runtime-config")).loadAgentRuntimeConfig();
      if (runtimeConfig.runtime === "stub") {
        return new DeterministicAgentRuntime().runTurn(input);
      }
      const { PiAgentRuntime } = await import("./pi-runtime");
      return new PiAgentRuntime(runtimeConfig).runTurn(input);
    }
  } satisfies AgentRuntime;
}

export function setAgentRuntimeForTesting(runtime: AgentRuntime | null) {
  runtimeOverride = runtime;
}

export type {
  AgentRuntime,
  AgentRuntimeInput,
  AgentRuntimeResult,
  AgentRuntimeStepOutput,
  RuntimeModelSettings
} from "./types";
