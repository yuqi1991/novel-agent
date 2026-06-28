import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
};

export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  ...timestamps
});

export const importedAssets = sqliteTable("imported_assets", {
  id: text("id").primaryKey(),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  originalFilename: text("original_filename"),
  contentType: text("content_type"),
  rawPayloadJson: text("raw_payload_json"),
  rawBlobPath: text("raw_blob_path"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const characterProfiles = sqliteTable("character_profiles", {
  id: text("id").primaryKey(),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  importedAssetId: text("imported_asset_id").references(() => importedAssets.id, {
    onDelete: "set null"
  }),
  name: text("name").notNull(),
  role: text("role", { enum: ["player", "non_player", "unspecified"] })
    .notNull()
    .default("unspecified"),
  profileText: text("profile_text").notNull().default(""),
  metadataJson: text("metadata_json").notNull().default("{}"),
  ...timestamps
});

export const storySettings = sqliteTable("story_settings", {
  storyId: text("story_id")
    .primaryKey()
    .references(() => stories.id, { onDelete: "cascade" }),
  playerCharacterProfileId: text("player_character_profile_id").references(
    () => characterProfiles.id,
    { onDelete: "set null" }
  ),
  fixedContextText: text("fixed_context_text").notNull().default(""),
  metadataJson: text("metadata_json").notNull().default("{}"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const worldEntries = sqliteTable("world_entries", {
  id: text("id").primaryKey(),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  importedAssetId: text("imported_asset_id").references(() => importedAssets.id, {
    onDelete: "set null"
  }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  inclusionMode: text("inclusion_mode", {
    enum: ["always", "triggered", "semantic", "disabled"]
  })
    .notNull()
    .default("semantic"),
  triggerConfigJson: text("trigger_config_json").notNull().default("{}"),
  tagsJson: text("tags_json").notNull().default("[]"),
  embeddingRef: text("embedding_ref"),
  ...timestamps
});

export const playSessions = sqliteTable("play_sessions", {
  id: text("id").primaryKey(),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  forkedFromSessionId: text("forked_from_session_id"),
  forkedFromPosition: integer("forked_from_position"),
  ...timestamps
});

export const conversationPositions = sqliteTable(
  "conversation_positions",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => playSessions.id, { onDelete: "cascade" }),
    positionIndex: integer("position_index").notNull(),
    kind: text("kind", { enum: ["player_message", "system_response"] }).notNull(),
    selectedVariantId: text("selected_variant_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [uniqueIndex("conversation_positions_session_position_idx").on(table.sessionId, table.positionIndex)]
);

export const playerMessages = sqliteTable("player_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => playSessions.id, { onDelete: "cascade" }),
  conversationPositionId: text("conversation_position_id")
    .notNull()
    .references(() => conversationPositions.id, { onDelete: "cascade" }),
  messageText: text("message_text").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const replyVariants = sqliteTable("reply_variants", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => playSessions.id, { onDelete: "cascade" }),
  conversationPositionId: text("conversation_position_id")
    .notNull()
    .references(() => conversationPositions.id, { onDelete: "cascade" }),
  variantIndex: integer("variant_index").notNull(),
  narrativeResponseText: text("narrative_response_text").notNull(),
  workflowTraceId: text("workflow_trace_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const progressWikiDocuments = sqliteTable("progress_wiki_documents", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => playSessions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  documentType: text("document_type").notNull().default("note"),
  body: text("body").notNull().default(""),
  tagsJson: text("tags_json").notNull().default("[]"),
  embeddingRef: text("embedding_ref"),
  ...timestamps
});

export const wikiSnapshots = sqliteTable("wiki_snapshots", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => playSessions.id, { onDelete: "cascade" }),
  memoryBoundaryPosition: integer("memory_boundary_position").notNull(),
  snapshotPayloadJson: text("snapshot_payload_json").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const orchestrationConfigurations = sqliteTable("orchestration_configurations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  modelDefaultsJson: text("model_defaults_json").notNull().default("{}"),
  ...timestamps
});

export const agentProfiles = sqliteTable("agent_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  agentRole: text("agent_role").notNull(),
  description: text("description").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  skillSetJson: text("skill_set_json").notNull().default("[]"),
  modelOverrideJson: text("model_override_json"),
  allowedToolsJson: text("allowed_tools_json").notNull().default("[]"),
  timeoutMs: integer("timeout_ms").notNull().default(60_000),
  ...timestamps
});

export const agentAssignments = sqliteTable("agent_assignments", {
  id: text("id").primaryKey(),
  orchestrationConfigurationId: text("orchestration_configuration_id")
    .notNull()
    .references(() => orchestrationConfigurations.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  agentRole: text("agent_role").notNull(),
  name: text("name").notNull(),
  instructions: text("instructions").notNull().default(""),
  skillSetJson: text("skill_set_json").notNull().default("[]"),
  modelOverrideJson: text("model_override_json"),
  allowedToolsJson: text("allowed_tools_json").notNull().default("[]"),
  timeoutMs: integer("timeout_ms").notNull().default(60_000),
  ...timestamps
});

export const workflowTraces = sqliteTable("workflow_traces", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").references(() => playSessions.id, { onDelete: "set null" }),
  orchestrationConfigurationId: text("orchestration_configuration_id").references(
    () => orchestrationConfigurations.id,
    { onDelete: "set null" }
  ),
  status: text("status", { enum: ["succeeded", "failed", "timed_out"] }).notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  finalOutputText: text("final_output_text"),
  errorJson: text("error_json")
});

export const workflowTraceSteps = sqliteTable("workflow_trace_steps", {
  id: text("id").primaryKey(),
  workflowTraceId: text("workflow_trace_id")
    .notNull()
    .references(() => workflowTraces.id, { onDelete: "cascade" }),
  agentAssignmentId: text("agent_assignment_id").references(() => agentAssignments.id, {
    onDelete: "set null"
  }),
  orderIndex: integer("order_index").notNull(),
  inputPayloadJson: text("input_payload_json").notNull().default("{}"),
  outputText: text("output_text"),
  subagentResultsJson: text("subagent_results_json"),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  status: text("status", { enum: ["succeeded", "failed", "timed_out"] }).notNull(),
  errorJson: text("error_json")
});

export const storyMaterialProposals = sqliteTable("story_material_proposals", {
  id: text("id").primaryKey(),
  storyId: text("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  sourceWorkflowTraceId: text("source_workflow_trace_id").references(() => workflowTraces.id, {
    onDelete: "set null"
  }),
  proposalType: text("proposal_type").notNull(),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: text("target_entity_id"),
  proposedChangeJson: text("proposed_change_json").notNull(),
  status: text("status", { enum: ["pending", "accepted", "rejected"] })
    .notNull()
    .default("pending"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  reviewedAt: text("reviewed_at")
});

export const externalToolConfigurations = sqliteTable("external_tool_configurations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  providerType: text("provider_type", { enum: ["mcp"] }).notNull().default("mcp"),
  configJson: text("config_json").notNull().default("{}"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  ...timestamps
});

export const storyRelations = relations(stories, ({ many, one }) => ({
  importedAssets: many(importedAssets),
  characterProfiles: many(characterProfiles),
  worldEntries: many(worldEntries),
  playSessions: many(playSessions),
  settings: one(storySettings)
}));

export const playSessionRelations = relations(playSessions, ({ one, many }) => ({
  story: one(stories, {
    fields: [playSessions.storyId],
    references: [stories.id]
  }),
  positions: many(conversationPositions),
  progressWikiDocuments: many(progressWikiDocuments),
  wikiSnapshots: many(wikiSnapshots)
}));

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
