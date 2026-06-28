# 使用 SQLite 作为本地主存储

Novel Agent 使用 SQLite 保存 Stories、Play Sessions、Conversation Logs、Reply Variants、Selected Paths、Wiki Snapshots、Story Material、Imported Assets 和 Orchestration Configurations。

JSONL 可以用于导入、导出、备份和交换，但不作为应用权威数据库。

选择 SQLite 的原因：

- 需要索引查询。
- 需要可靠处理 session fork lineage。
- 需要版本化记忆快照和按楼层查找。
- 需要 reply variant selection。
- 需要后续 schema migration。

如果把 JSONL 作为主存储，fork、selected path 和 snapshot lookup 会变得脆弱。
