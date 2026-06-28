import { afterEach, describe, expect, it, vi } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import { workflowTraceSteps, workflowTraces } from "@/db/schema";
import { setAgentRuntimeForTesting } from "./agent-runtime";
import { createPlaySession } from "./session-service";
import { runGenerationWorkflow } from "./orchestration-service";
import { createStory } from "./story-service";
import { createCharacterProfile, createWorldEntry } from "./story-material-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-orchestration-runtime-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  setAgentRuntimeForTesting(null);
  vi.unstubAllEnvs();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("orchestration-service runtime execution", () => {
  it("runs the configured multi-agent workflow and returns the final agent output", async () => {
    const db = await createTestDatabase();
    vi.stubEnv("NOVEL_AGENT_USER_DATA_DIR", path.join(tempDir, "user_data"));
    const story = await createStory({ title: "莉莉儿" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "默认存档" }, db);
    await createCharacterProfile(
      {
        storyId: story.id,
        name: "莉莉儿",
        role: "non_player",
        profileText: "金发蓝眼的精灵猎手。"
      },
      db
    );
    await createWorldEntry(
      {
        storyId: story.id,
        title: "阿尔卡迪亚大陆",
        body: "充满魔法力量的大陆。",
        inclusionMode: "always"
      },
      db
    );

    const calls: Array<{ prompt: string; agentId?: string; previousCount: number }> = [];
    setAgentRuntimeForTesting({
      async runTurn(input) {
        calls.push({
          prompt: input.prompt,
          agentId: input.fileAgent?.id,
          previousCount: input.previousStepOutputs?.length ?? 0
        });
        return {
          outputText: input.fileAgent?.id === "plot-designer"
            ? "剧情计划：莉莉儿察觉玩家进入小院，先保持警惕再试探。"
            : "莉莉儿抬起蓝眼看向你，轻声回应。",
          runtimeName: "fake-runtime",
          modelProvider: "test",
          modelName: "fake"
        };
      }
    });

    const result = await runGenerationWorkflow(
      {
        storyId: story.id,
        sessionId: session.id,
        playerMessage: "我走进小院。"
      },
      db
    );

    const traces = await db.select().from(workflowTraces);
    const steps = await db.select().from(workflowTraceSteps);
    expect(result.narrativeResponseText).toBe("莉莉儿抬起蓝眼看向你，轻声回应。");
    expect(calls.map((call) => call.agentId)).toEqual(["plot-designer", "literary-writer"]);
    expect(calls[0]?.prompt).toContain("我走进小院。");
    expect(calls[0]?.prompt).toContain("莉莉儿");
    expect(calls[0]?.prompt).toContain("阿尔卡迪亚大陆");
    expect(calls[1]?.previousCount).toBe(1);
    expect(calls[1]?.prompt).toContain("剧情计划：莉莉儿察觉玩家进入小院");
    expect(traces).toEqual([
      expect.objectContaining({
        status: "succeeded",
        finalOutputText: "莉莉儿抬起蓝眼看向你，轻声回应。"
      })
    ]);
    expect(steps).toHaveLength(2);
    expect(steps[0]?.inputPayloadJson).toContain("fake-runtime");
    expect(steps[0]?.inputPayloadJson).toContain("我走进小院。");
    expect(steps[1]?.outputText).toBe("莉莉儿抬起蓝眼看向你，轻声回应。");
  });
});
