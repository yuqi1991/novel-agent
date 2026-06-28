# Novel Agent Technical Architecture

This document proposes the MVP technical architecture for implementing `docs/mvp-prd.md`. It complements `docs/novel-agent-design.md` by translating the product/domain decisions into implementation boundaries, framework choices, service seams, and an initial SQLite data model.

## Status

This is the MVP technical architecture. Core storage and framework decisions are recorded in `docs/adr/` as ADR 0001 through ADR 0006.

## Recommended MVP Stack

### Language and Runtime

Use TypeScript across the application.

Rationale:

- Agent orchestration, Web UI, schema validation, and MCP integration all benefit from shared types.
- A single language keeps MVP iteration fast.
- pi-agent and MCP-style integrations are likely to fit a TypeScript runtime cleanly, but pi-agent must still be evaluated behind an adapter.

### Web App Framework

Use Next.js App Router for the MVP Web UI and local backend routes/actions.

Rationale:

- The MVP needs a Web UI with forms, data mutations, route-level workspaces, and server-side access to SQLite.
- Keeping UI and backend actions in one framework avoids prematurely splitting frontend/backend services.
- The app can later be packaged as a desktop app or deployed locally behind a Node process if needed.

Alternative considered:

- Vite + React + separate API server. This is simpler for a pure SPA, but creates an extra backend boundary immediately. The MVP benefits from fewer moving parts.
- Tauri shell first. Useful for packaged desktop distribution, but not required to validate the Web UI and domain flows. Keep it as a later packaging option.

### UI Layer

Use React with a restrained component system. Tailwind CSS plus a headless/component library such as shadcn/ui is a reasonable default once scaffolding begins.

The UI should be work-focused rather than landing-page oriented. The primary surfaces are Story Library, Play Workspace, Story Material Editor, Progress Wiki Editor, Orchestration Builder, and Trace Viewer.

### Persistence

Use git-ignored `user_data/` as the repo-local runtime data root. Use SQLite as the authoritative local structured store, located by default at `user_data/novel-agent.db`. Use Drizzle ORM with generated migrations as the recommended TypeScript database layer.

Rationale:

- The domain needs relational integrity for Stories, Play Sessions, Conversation Positions, Reply Variants, Selected Paths, Wiki Snapshots, Imported Assets, and Orchestration Configurations.
- Drizzle keeps schema definitions close to TypeScript while still producing explicit migrations.
- JSON fields can be used for flexible imported payloads, skill configuration, model configuration, and provider-specific metadata.
- Runtime config, provider model definitions, provider auth, agent prompt files, and agent skills live under local ignored `user_data/` so the app does not depend on `~/.pi/agent`.
- Creating a Story or Play Session also creates the corresponding repo-local directories under `user_data/stories/<story-id>/saves/<session-id>/wiki/`. In this slice, Progress Wiki document records are still stored in SQLite; the directory layout is reserved for the file-backed wiki writer.

The MVP `user_data/` layout is:

```text
user_data/
  config.yaml
  novel-agent.db
  providers/auth.json
  providers/models.json
  agents/<agent-id>/agent.yaml
  agents/<agent-id>/system.md
  agents/<agent-id>/skills/<skill-id>/SKILL.md
  agents/<agent-id>/prompts/
  stories/
  lorebooks/
```

### Agent Runtime

Define an internal `AgentRuntime` interface and implement a pi-agent adapter if pi-agent satisfies the requirements.

The Role-Play Domain must not depend directly on pi-agent data structures. The adapter owns conversion between domain-level requests and runtime-level execution.

Required runtime capabilities:

- LLM provider abstraction.
- Multi-turn agent execution.
- Tool calling.
- Skill loading/injection.
- One-level Subagent spawning.
- Per-agent timeout.
- Capturable step input/output for Workflow Trace.

### External Tools

Use MCP as the primary external tool integration mechanism. Users provide MCP configuration; the app exposes those external tools only to selected Skill Sets.

Core MVP play must work without external tools or network access. Built-in local capabilities should cover Story Material retrieval, Conversation Log querying, Context Pack assembly, Progress Wiki Skill behavior, and Story Material Proposal creation.

### Testing

Use Vitest for service/domain tests and Playwright for Web UI smoke and workflow tests.

Test through the highest stable boundary available. Early slices should prefer service/API tests over low-level repository tests unless the persistence behavior itself is the subject.

## Architecture Layers

### Role-Play Domain

Owns product concepts:

- Story
- Story Material
- Character Profile
- World Entry
- Imported Asset
- Play Session
- Conversation Log
- Conversation Position
- Reply Variant
- Selected Path
- Session Fork
- Progress Wiki
- Wiki Snapshot
- Orchestration Configuration
- Context Pack

This layer should be deterministic and testable without making LLM calls.

### Multi-Agent Scheduler

Owns Generation Workflow execution:

- Loads the file-defined workflow from `user_data/config.yaml` for the current MVP play loop. Database Orchestration Configurations remain for UI compatibility and future selection.
- Builds the initial Context Pack.
- Runs configured agents in Linear Workflow order.
- Passes Agent Output strings downstream.
- Enforces Agent Timeout.
- Records Workflow Trace.
- Returns a Reply Variant or Workflow Failure.

The scheduler should not own story-specific rules beyond invoking domain services.

### Agent Runtime

Owns the mechanics of invoking LLM agents:

- Provider/model calls.
- Tool call loop.
- Skill material injection.
- Subagent execution.
- Runtime-level errors and cancellation.

The runtime returns raw Agent Output and traceable execution details to the scheduler.

## Suggested Module Boundaries

These are conceptual module boundaries, not required file paths.

### story-service

Responsibilities:

- Create/list/update Stories.
- Manage Story Material.
- Preserve Imported Assets.
- Convert SillyTavern imports to Character Profiles and World Entries.
- Manage Story Material Proposals.

### session-service

Responsibilities:

- Create/list/update Play Sessions.
- Append player messages.
- Persist Reply Variants.
- Track Selected Variants and Selected Path.
- Enforce Mutable Tail rules.
- Create Session Forks.

### progress-wiki-service

Responsibilities:

- Manage session-owned Progress Wiki documents.
- Create cumulative Wiki Snapshots at Memory Boundaries.
- Select the correct Wiki Snapshot for forks.
- Apply Automatic Wiki Curation through authorized skill behavior.

### context-assembly-service

Responsibilities:

- Assemble Context Packs from Selected Path, recent conversation, Story Material, World Entries, optional Player Character, and Progress Wiki content.
- Apply Entry Inclusion Mode rules.
- Keep context assembly deterministic and inspectable.

### orchestration-service

Responsibilities:

- Manage Orchestration Configurations and Agent Assignments.
- Resolve Model Defaults and Model Overrides.
- Load repo-local workflow/agent definitions from `user_data/config.yaml` and `user_data/agents/*`.
- Execute Linear Generation Workflows through the Multi-Agent Scheduler.
- Persist one Workflow Trace Step per agent invocation.

### runtime-adapter

Responsibilities:

- Adapt internal AgentRuntime calls to pi-agent or another runtime.
- Enforce one-level Subagent limit.
- Map tools and skills into runtime-specific configuration.
- Normalize runtime errors and outputs.

MVP implementation uses `@earendil-works/pi-coding-agent` through an in-process adapter. Provider credentials stay in Pi auth/env configuration rather than the Web UI. Automated tests use a deterministic stub runtime.

The Pi adapter must construct `AuthStorage` and `ModelRegistry` from repo-local paths: `user_data/providers/auth.json` and `user_data/providers/models.json`. It must load each file-defined agent's `system.md`, `prompts/`, and `skills/` through Pi's resource loader. Skills use the standard Pi/Codex-style layout: `skills/<skill-id>/SKILL.md` with frontmatter `name` and `description`.

### trace-service

Responsibilities:

- Persist Workflow Traces.
- Provide trace summaries and detailed step inspection to Trace Viewer.
- Keep traces separate from Conversation Log.

## Initial SQLite Data Model

The schema should use stable IDs, timestamps, and optimistic update fields where useful. JSON columns are acceptable for flexible metadata, imported payloads, provider settings, skill configuration, and trace payloads.

### stories

Stores Story containers.

Suggested fields:

- id
- title
- description
- created_at
- updated_at

### imported_assets

Stores original imported files or metadata payloads.

Suggested fields:

- id
- story_id
- source_type: `sillytavern_character` | `sillytavern_world` | other future values
- original_filename
- content_type
- raw_payload_json
- raw_blob_path, optional for PNG or large source files
- created_at

### character_profiles

Stores native Character Profiles.

Suggested fields:

- id
- story_id
- imported_asset_id, nullable
- name
- role: `player` | `non_player` | `unspecified`
- profile_text
- metadata_json
- created_at
- updated_at

### story_settings

Stores story-level optional selections and fixed settings.

Suggested fields:

- story_id
- player_character_profile_id, nullable
- fixed_context_text
- metadata_json
- updated_at

### world_entries

Stores native World Entries.

Suggested fields:

- id
- story_id
- imported_asset_id, nullable
- title
- body
- inclusion_mode: `always` | `triggered` | `semantic` | `disabled`
- trigger_config_json
- tags_json
- embedding_ref, nullable
- created_at
- updated_at

### play_sessions

Stores isolated game saves under a Story.

Suggested fields:

- id
- story_id
- title
- forked_from_session_id, nullable
- forked_from_position, nullable
- created_at
- updated_at

### conversation_positions

Stores ordered play positions in a Play Session.

Suggested fields:

- id
- session_id
- position_index
- kind: `player_message` | `system_response`
- selected_variant_id, nullable
- created_at

For player messages, the content can be stored directly in a variant-like message table or in a dedicated message table. The key invariant is that system response positions may have multiple Reply Variants, while player positions normally have one user-authored message.

### reply_variants

Stores all generated alternatives for a system response position.

Suggested fields:

- id
- session_id
- conversation_position_id
- variant_index
- narrative_response_text
- workflow_trace_id, nullable
- created_at

### player_messages

Stores user-authored messages.

Suggested fields:

- id
- session_id
- conversation_position_id
- message_text
- created_at

### progress_wiki_documents

Stores editable session-owned wiki documents.

Suggested fields:

- id
- session_id
- title
- document_type
- body
- tags_json
- embedding_ref, nullable
- created_at
- updated_at

### wiki_snapshots

Stores cumulative Progress Wiki snapshots at Memory Boundaries.

Suggested fields:

- id
- session_id
- memory_boundary_position
- snapshot_payload_json
- created_at

The payload should represent the full Progress Wiki as of the boundary, not a delta.

### orchestration_configurations

Stores reusable Orchestration Configurations.

Suggested fields:

- id
- name
- description
- model_defaults_json
- created_at
- updated_at

### agent_assignments

Stores ordered steps in an Orchestration Configuration.

Suggested fields:

- id
- orchestration_configuration_id
- order_index
- agent_role
- name
- instructions
- skill_set_json
- model_override_json, nullable
- allowed_tools_json
- timeout_ms
- created_at
- updated_at

### workflow_traces

Stores diagnostic records for Generation Workflow attempts.

Suggested fields:

- id
- session_id
- orchestration_configuration_id
- status: `succeeded` | `failed` | `timed_out`
- started_at
- completed_at
- final_output_text, nullable
- error_json, nullable

### workflow_trace_steps

Stores individual agent step trace records.

Suggested fields:

- id
- workflow_trace_id
- agent_assignment_id
- order_index
- input_payload_json
- output_text, nullable
- subagent_results_json, nullable
- started_at
- completed_at
- status
- error_json, nullable

### story_material_proposals

Stores agent-proposed changes to shared Story Material.

Suggested fields:

- id
- story_id
- source_workflow_trace_id, nullable
- proposal_type
- target_entity_type
- target_entity_id, nullable
- proposed_change_json
- status: `pending` | `accepted` | `rejected`
- created_at
- reviewed_at, nullable

### external_tool_configurations

Stores user-provided MCP or other external tool configuration.

Suggested fields:

- id
- name
- provider_type: `mcp` | future values
- config_json
- enabled
- created_at
- updated_at

## Key Invariants

- Story Material is shared across Play Sessions under the same Story.
- Progress Wiki belongs to one Play Session only.
- Conversation Log is the raw source of session history.
- Progress Wiki is derived and editable, not the raw fact source.
- All Reply Variants are stored.
- Selected Path is computed from selected variants and positions.
- Only the Mutable Tail can be changed in place.
- Changing an older path requires Session Fork.
- Wiki Snapshots are cumulative full snapshots.
- A fork inherits the latest Wiki Snapshot whose Memory Boundary is not greater than the fork position.
- Failed Generation Workflows do not write Narrative Responses or Reply Variants.
- Workflow Traces are separate from Conversation Log.
- Subagents cannot write persistent state directly.
- Story Material Proposals require user review.

## Generation Workflow Flow

1. User submits a player message in the Play Workspace.
2. session-service appends a player Conversation Position.
3. context-assembly-service creates a Context Pack from Selected Path, recent messages, Story Material, World Entries, optional Player Character, and Progress Wiki.
4. orchestration-service loads the file-defined workflow from `user_data/config.yaml` and the agent files under `user_data/agents/`.
5. Multi-Agent Scheduler executes configured agents in Linear Workflow order.
6. Agent Runtime invokes each agent with its file-defined system prompt, skills, prompts, model settings, timeout, and input.
7. Scheduler records Workflow Trace steps.
8. If any step fails or times out, the workflow ends as Workflow Failure and no Reply Variant is created.
9. If the workflow succeeds, the final Agent Output is stored as a Reply Variant for a system response Conversation Position.
10. The new Reply Variant becomes the Selected Variant for the Mutable Tail.

## Reroll Flow

1. User requests reroll at the Mutable Tail.
2. The system reuses the selected-path context up to the prior player message.
3. A new Generation Workflow runs.
4. On success, a new Reply Variant is appended to the same system response position.
5. The new Reply Variant becomes selected by default.
6. Older variants remain available for left/right navigation.

## Fork Flow

1. User chooses an older Conversation Position or Reply Variant.
2. session-service creates a new Play Session with fork metadata.
3. The fork copies or references the selected source prefix through the fork point.
4. Source records after the fork point are excluded.
5. progress-wiki-service selects the latest Wiki Snapshot whose Memory Boundary is not greater than the fork point.
6. The new session continues independently.

## Memory Curation Flow

1. The system determines that a Play Session has crossed a curation cadence.
2. The Memory Boundary is set behind the recent mutable range.
3. A memory-focused Agent Assignment uses Progress Wiki Skill behavior to summarize stable Conversation Log ranges.
4. progress-wiki-service updates wiki documents.
5. progress-wiki-service creates a cumulative Wiki Snapshot for the Memory Boundary.

## Recorded ADRs

- ADR 0001: Use SQLite as the primary local store.
- ADR 0002: Use Next.js App Router for the MVP Web UI.
- ADR 0003: Use Drizzle for SQLite schema and migrations.
- ADR 0004: Keep Agent Runtime behind an adapter.
- ADR 0005: Use MCP for optional external tools.
- ADR 0006: Use Linear Workflows for MVP orchestration.

## External References

- Tauri supports apps built with web frontends and can be considered later for desktop packaging: https://tauri.app/start/
- Next.js App Router provides a full-stack React application framework with routing, data mutation, testing, and deployment documentation: https://nextjs.org/docs/app/getting-started
- Drizzle supports SQLite connections and migration workflows in TypeScript: https://orm.drizzle.team/docs/get-started/sqlite-new
- MCP is an open standard for connecting AI applications to external systems, tools, data sources, and workflows: https://modelcontextprotocol.io/docs/getting-started/intro
