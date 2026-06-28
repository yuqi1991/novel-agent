import type { AgentRuntime, AgentRuntimeInput } from "./types";

export class DeterministicAgentRuntime implements AgentRuntime {
  async runTurn(input: AgentRuntimeInput) {
    return {
      outputText: buildDeterministicNarrativeResponse(input),
      runtimeName: "deterministic-stub",
      modelProvider: "local-stub",
      modelName: "deterministic-narrative-v0"
    };
  }
}

function buildDeterministicNarrativeResponse(input: AgentRuntimeInput) {
  const contextPack = input.contextPack;
  const materialParts = [
    contextPack.storyMaterial.fixedContextText.trim()
      ? `context: ${compact(contextPack.storyMaterial.fixedContextText)}`
      : null,
    contextPack.storyMaterial.characters.length > 0
      ? `characters: ${contextPack.storyMaterial.characters.slice(0, 3).map((profile) => profile.name).join(", ")}`
      : null,
    contextPack.storyMaterial.playerCharacter ? `player: ${contextPack.storyMaterial.playerCharacter.name}` : null,
    contextPack.worldEntries.length > 0
      ? `world: ${contextPack.worldEntries.slice(0, 3).map((entry) => entry.title).join(", ")}`
      : null,
    contextPack.progressWiki.length > 0
      ? `wiki: ${contextPack.progressWiki.slice(0, 3).map((document) => document.title).join(", ")}`
      : null
  ].filter((part): part is string => Boolean(part));
  const materialSummary = materialParts.length > 0 ? materialParts.join("; ") : "no story material yet";
  const variantPrefix = input.variantIndex > 0 ? `Alternative ${input.variantIndex + 1}: ` : "";

  return `Narrative Response: ${variantPrefix}The story answers your latest move with ${materialSummary}. The scene advances in direct response to the player's choice.`;
}

function compact(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 240);
}
