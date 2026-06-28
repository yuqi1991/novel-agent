import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getWorkflowAgents, loadAgentRuntimeConfig } from "./runtime-config";

const envKeys = [
  "NOVEL_AGENT_RUNTIME",
  "NOVEL_AGENT_PI_CWD",
  "NOVEL_AGENT_PI_AGENT_DIR",
  "NOVEL_AGENT_PI_AUTH_PATH",
  "NOVEL_AGENT_PI_MODELS_PATH",
  "NOVEL_AGENT_PI_NO_TOOLS",
  "NOVEL_AGENT_USER_DATA_DIR"
];

let tempDir = "";
let originalCwd = "";
const originalEnv = { ...process.env };

afterEach(() => {
  if (originalCwd) {
    process.chdir(originalCwd);
  }
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
  vi.unstubAllEnvs();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  tempDir = "";
  originalCwd = "";
});

describe("loadAgentRuntimeConfig", () => {
  it("loads repo-local user_data config, agents, providers, workflows, and standard SKILL.md files", () => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-runtime-config-test-"));
    process.chdir(tempDir);

    const config = loadAgentRuntimeConfig();
    const agents = getWorkflowAgents(config);

    expect(config).toEqual(expect.objectContaining({
      runtime: "pi",
      userDataDir: path.join(tempDir, "user_data"),
      cwd: tempDir,
      agentDir: tempDir,
      authPath: path.join(tempDir, "user_data", "providers", "auth.json"),
      modelsPath: path.join(tempDir, "user_data", "providers", "models.json"),
      defaultWorkflowId: "default_play",
      defaultProvider: "deepseek",
      defaultModel: "deepseek-v4-flash",
      noTools: true
    }));
    expect(agents.map((agent) => agent.id)).toEqual(["plot-designer", "literary-writer"]);
    expect(fs.readFileSync(path.join(agents[0].skillPaths[0], "plot-planning", "SKILL.md"), "utf8"))
      .toContain("name: plot-planning");
    expect(fs.readFileSync(path.join(agents[1].skillPaths[0], "rp-prose-writing", "SKILL.md"), "utf8"))
      .toContain("description: Write the final Chinese role-play prose response from a plan.");
  });
});
