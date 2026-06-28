# 使用 Drizzle 管理 SQLite Schema 和迁移

Novel Agent 使用 Drizzle ORM 定义 TypeScript SQLite schema，并生成显式迁移。

领域模型需要关系化表达 Stories、Play Sessions、Reply Variants、Wiki Snapshots、Story Material、Orchestration Configurations 和 Workflow Traces。Drizzle 可以让 schema 靠近应用类型，同时保留可 review 的迁移文件。
