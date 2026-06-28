import type { agentAssignments, orchestrationConfigurations } from "@/db/schema";
import type { ContextPack } from "@/services/context-assembly-service";
import type { UserDataAgentConfig } from "./runtime-config";

export type RuntimeModelSettings = {
  provider?: string;
  model?: string;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  [key: string]: unknown;
};

export type AgentRuntimeInput = {
  prompt: string;
  contextPack: ContextPack;
  configuration: typeof orchestrationConfigurations.$inferSelect;
  assignment: typeof agentAssignments.$inferSelect | null;
  fileAgent?: UserDataAgentConfig;
  modelSettings: RuntimeModelSettings;
  timeoutMs: number;
  variantIndex: number;
  previousStepOutputs?: AgentRuntimeStepOutput[];
};

export type AgentRuntimeStepOutput = {
  agentId: string;
  agentName: string;
  outputText: string;
};

export type AgentRuntimeResult = {
  outputText: string;
  runtimeName: string;
  modelProvider?: string;
  modelName?: string;
  metadata?: Record<string, unknown>;
};

export interface AgentRuntime {
  runTurn(input: AgentRuntimeInput): Promise<AgentRuntimeResult>;
}
