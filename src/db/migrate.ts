import { migrate } from "drizzle-orm/libsql/migrator";
import { createDatabase } from "./client";

async function main() {
  const db = createDatabase();
  await migrate(db, { migrationsFolder: "drizzle" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
