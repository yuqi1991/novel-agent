CREATE TABLE `agent_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`orchestration_configuration_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`agent_role` text NOT NULL,
	`name` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`skill_set_json` text DEFAULT '[]' NOT NULL,
	`model_override_json` text,
	`allowed_tools_json` text DEFAULT '[]' NOT NULL,
	`timeout_ms` integer DEFAULT 60000 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`orchestration_configuration_id`) REFERENCES `orchestration_configurations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`agent_role` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`skill_set_json` text DEFAULT '[]' NOT NULL,
	`model_override_json` text,
	`allowed_tools_json` text DEFAULT '[]' NOT NULL,
	`timeout_ms` integer DEFAULT 60000 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `character_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`imported_asset_id` text,
	`name` text NOT NULL,
	`role` text DEFAULT 'unspecified' NOT NULL,
	`profile_text` text DEFAULT '' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`imported_asset_id`) REFERENCES `imported_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `conversation_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`position_index` integer NOT NULL,
	`kind` text NOT NULL,
	`selected_variant_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversation_positions_session_position_idx` ON `conversation_positions` (`session_id`,`position_index`);--> statement-breakpoint
CREATE TABLE `external_tool_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider_type` text DEFAULT 'mcp' NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imported_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`source_type` text NOT NULL,
	`original_filename` text,
	`content_type` text,
	`raw_payload_json` text,
	`raw_blob_path` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orchestration_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`model_defaults_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `play_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`title` text NOT NULL,
	`forked_from_session_id` text,
	`forked_from_position` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`conversation_position_id` text NOT NULL,
	`message_text` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_position_id`) REFERENCES `conversation_positions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `progress_wiki_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`title` text NOT NULL,
	`document_type` text DEFAULT 'note' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`embedding_ref` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reply_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`conversation_position_id` text NOT NULL,
	`variant_index` integer NOT NULL,
	`narrative_response_text` text NOT NULL,
	`workflow_trace_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_position_id`) REFERENCES `conversation_positions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `story_material_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`source_workflow_trace_id` text,
	`proposal_type` text NOT NULL,
	`target_entity_type` text NOT NULL,
	`target_entity_id` text,
	`proposed_change_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_workflow_trace_id`) REFERENCES `workflow_traces`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `story_settings` (
	`story_id` text PRIMARY KEY NOT NULL,
	`player_character_profile_id` text,
	`fixed_context_text` text DEFAULT '' NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_character_profile_id`) REFERENCES `character_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `wiki_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`memory_boundary_position` integer NOT NULL,
	`snapshot_payload_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workflow_trace_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_trace_id` text NOT NULL,
	`agent_assignment_id` text,
	`order_index` integer NOT NULL,
	`input_payload_json` text DEFAULT '{}' NOT NULL,
	`output_text` text,
	`subagent_results_json` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	`status` text NOT NULL,
	`error_json` text,
	FOREIGN KEY (`workflow_trace_id`) REFERENCES `workflow_traces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_assignment_id`) REFERENCES `agent_assignments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `workflow_traces` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`orchestration_configuration_id` text,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`final_output_text` text,
	`error_json` text,
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`orchestration_configuration_id`) REFERENCES `orchestration_configurations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `world_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`story_id` text NOT NULL,
	`imported_asset_id` text,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`inclusion_mode` text DEFAULT 'semantic' NOT NULL,
	`trigger_config_json` text DEFAULT '{}' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`embedding_ref` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`story_id`) REFERENCES `stories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`imported_asset_id`) REFERENCES `imported_assets`(`id`) ON UPDATE no action ON DELETE set null
);
