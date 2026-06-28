import { afterEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "@/db/client";
import { createStory } from "./story-service";
import { createPlaySession, submitPlayerMessage } from "./session-service";
import { listWorkflowTracesForSession } from "./trace-service";

let tempDir: string;

async function createTestDatabase() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-trace-test-"));
  const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
  await migrate(db, { migrationsFolder: "drizzle" });
  return db;
}

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("trace-service", () => {
  it("lists Workflow Traces with configuration and step details for a Play Session", async () => {
    const db = await createTestDatabase();
    const story = await createStory({ title: "Trace Story" }, db);
    const session = await createPlaySession({ storyId: story.id, title: "Trace Save" }, db);

    await submitPlayerMessage({ storyId: story.id, sessionId: session.id, messageText: "I open the brass door." }, db);

    const traces = await listWorkflowTracesForSession(session.id, db);

    expect(traces).toHaveLength(1);
    expect(traces[0]).toEqual(
      expect.objectContaining({
        sessionId: session.id,
        status: "succeeded",
        configuration: expect.objectContaining({ name: expect.any(String) }),
        steps: [
          expect.objectContaining({
            orderIndex: 0,
            status: "succeeded",
            inputPayloadJson: expect.stringContaining("I open the brass door"),
            outputText: expect.stringContaining("Narrative Response")
          })
        ]
      })
    );
  });
});
