import { describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDatabase } from "./client";

async function withMigratedDatabase<T>(fn: (db: ReturnType<typeof createDatabase>) => Promise<T>) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "novel-agent-migration-"));
  try {
    const db = createDatabase(`file:${path.join(tempDir, "test.db")}`);
    await migrate(db, { migrationsFolder: "drizzle" });
    return await fn(db);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("SQLite migrations", () => {
  it("creates the MVP domain tables", async () => {
    await withMigratedDatabase(async (db) => {
      const rows = await db.all<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      );
      const tableNames = rows.map((row) => row.name);

      expect(tableNames).toEqual(
        expect.arrayContaining([
          "stories",
          "story_settings",
          "character_profiles",
          "world_entries",
          "play_sessions",
          "conversation_positions",
          "reply_variants",
          "progress_wiki_documents",
          "wiki_snapshots",
          "orchestration_configurations",
          "agent_profiles",
          "agent_assignments",
          "workflow_traces"
        ])
      );
    });
  });
});
