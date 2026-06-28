import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export function resolveDatabaseUrl() {
  return process.env.DATABASE_URL ?? "file:./user_data/novel-agent.db";
}

function ensureLocalDirectory(url: string) {
  if (!url.startsWith("file:")) {
    return;
  }

  const filePath = url.slice("file:".length);
  const dir = path.dirname(filePath);
  if (dir && dir !== ".") {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function createDatabase(databaseUrl = resolveDatabaseUrl()) {
  ensureLocalDirectory(databaseUrl);
  const client = createClient({ url: databaseUrl });
  return drizzle(client, { schema });
}

export const db = createDatabase();
export type Database = ReturnType<typeof createDatabase>;
