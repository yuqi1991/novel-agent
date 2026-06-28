import type { agentAssignments, orchestrationConfigurations } from "@/db/schema";
import type { ContextPack } from "@/services/context-assembly-service";

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
  modelSettings: RuntimeModelSettings;
  timeoutMs: number;
  variantIndex: number;
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
