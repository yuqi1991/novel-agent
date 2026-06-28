# Use Drizzle for SQLite Schema and Migrations

Novel Agent uses Drizzle ORM for TypeScript SQLite schema definitions and generated migrations. The domain needs explicit relational modeling for Stories, Play Sessions, Reply Variants, Wiki Snapshots, Story Material, Orchestration Configurations, and Workflow Traces, while still keeping schema definitions close to application types.
