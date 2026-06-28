# Use SQLite as the Primary Local Store

Novel Agent stores Stories, Play Sessions, Conversation Logs, Reply Variants, Selected Paths, Wiki Snapshots, Story Material, Imported Assets, and Orchestration Configurations in SQLite as the primary local store. JSONL may be used for import, export, backup, and interchange, but not as the authoritative application database.

SQLite is the default because the product needs indexed queries, fork lineage, versioned memory snapshots, variant selection, retrieval metadata, and future schema migrations. JSONL remains valuable as an append-friendly exchange format, but making it primary storage would make session forks, selected paths, and snapshot lookup fragile.
