import { DeterministicAgentRuntime } from "./stub-runtime";
import type { AgentRuntime } from "./types";

let runtimeOverride: AgentRuntime | null = null;

export function getAgentRuntime() {
  if (runtimeOverride) {
    return runtimeOverride;
  }

  const forcedRuntime = process.env.NOVEL_AGENT_RUNTIME || (process.env.NODE_ENV === "test" ? "stub" : "");
  if (forcedRuntime === "stub") {
    return new DeterministicAgentRuntime();
  }

  return {
    async runTurn(input) {
      const { loadAgentRuntimeConfig } = await import("./runtime-config");
      const config = loadAgentRuntimeConfig();
      if (config.runtime === "stub") {
        return new DeterministicAgentRuntime().runTurn(input);
      }
      const { PiAgentRuntime } = await import("./pi-runtime");
      return new PiAgentRuntime(config).runTurn(input);
    }
  } satisfies AgentRuntime;
}

export function setAgentRuntimeForTesting(runtime: AgentRuntime | null) {
  runtimeOverride = runtime;
}

export type { AgentRuntime, AgentRuntimeInput, AgentRuntimeResult, RuntimeModelSettings } from "./types";
