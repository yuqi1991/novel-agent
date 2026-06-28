CREATE TABLE IF NOT EXISTS `agent_profiles` (
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
