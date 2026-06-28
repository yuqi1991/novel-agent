import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAgentRuntimeConfig } from "./runtime-config";

const envKeys = [
  "NOVEL_AGENT_RUNTIME",
  "NOVEL_AGENT_PI_CWD",
  "NOVEL_AGENT_PI_AGENT_DIR",
  "NOVEL_AGENT_PI_AUTH_PATH",
  "NOVEL_AGENT_PI_MODELS_PATH",
  "NOVEL_AGENT_PI_SKILL_PATHS",
  "NOVEL_AGENT_PI_PROMPT_PATHS",
  "NOVEL_AGENT_PI_NO_TOOLS"
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
  it("expands local config paths for Pi runtime files and skill directories", () => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-runtime-config-test-"));
    process.chdir(tempDir);
    fs.mkdirSync("config", { recursive: true });
    fs.writeFileSync(
      path.join("config", "agent-runtime.json"),
      JSON.stringify({
        runtime: "pi",
        cwd: ".",
        agentDir: "~/.pi/agent",
        authPath: "~/.pi/agent/auth.json",
        modelsPath: "./local-models.json",
        skillPaths: ["./skills"],
        promptPaths: ["~/prompts"],
        noTools: false
      })
    );

    vi.stubEnv("HOME", "/home/tester");

    expect(loadAgentRuntimeConfig()).toEqual({
      runtime: "pi",
      cwd: tempDir,
      agentDir: "/home/tester/.pi/agent",
      authPath: "/home/tester/.pi/agent/auth.json",
      modelsPath: path.join(tempDir, "local-models.json"),
      skillPaths: [path.join(tempDir, "skills")],
      promptPaths: ["/home/tester/prompts"],
      noTools: false
    });
  });
});
