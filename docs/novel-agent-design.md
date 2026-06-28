# Novel Agent Design

Novel Agent is a single-user local Web UI for playing and authoring agent-driven text role-play stories. The MVP focuses on one player, multiple reusable Stories, isolated Play Sessions, SillyTavern character/world imports, configurable multi-agent writing workflows, and session-scoped long-term memory.

## Product Scope

The MVP is a single-player role-play framework. The user manages multiple Stories, opens one or more Play Sessions under each Story, plays as an optional Player Character, and receives one unified Narrative Response per turn.

The MVP does not include multiplayer, accounts, cloud sync, sharing, marketplaces, SillyTavern export, SillyTavern full chat migration, group chat migration, plugin migration, or prompt preset migration.

The first usable surface is a local Web UI backed by a local SQLite database.

## Core Domain Model

A Story is the reusable setting container. It owns shared Story Material such as Character Profiles, World Entries, imported SillyTavern assets, and fixed world instructions.

A Play Session is an isolated game save under a Story. Each Play Session owns its own Conversation Log, Selected Path, Reply Variants, Progress Wiki, and Wiki Snapshots. Multiple Play Sessions under the same Story may diverge and contradict each other without contaminating shared Story Material.

A Player Character may be defined, but is not required. If absent, no structured player-character material is injected into context. System behavior around minor player speech or reactions is a user-defined Player Agency Preference placed in agent instructions or skills, not a product-wide fixed rule.

The user-visible system output for a turn is a single Narrative Response. MVP orchestration uses Writing Team Mode: agents perform functional writing and reasoning jobs. Village Mode, where one agent independently embodies one Non-Player Character, is a future extension.

## Conversation, Reroll, and Forking

The Conversation Log is the raw source of what happened in a Play Session. It stores user messages, system-visible Narrative Responses, and all Reply Variants.

A Reply Variant is one generated alternative for a system response position. The latest system response is the Mutable Tail: the user may switch variants or reroll in place there. If the user continues by entering the next message, the currently Selected Variant becomes part of the Selected Path.

Older variants remain stored, but changing an older position cannot rewrite the current Play Session in place. To continue from an older variant or older Conversation Position, the user creates a Session Fork.

A Session Fork inherits the source session prefix through the selected Conversation Position and excludes later conversation records. For example, if the source session is at position 29 and the user forks from 25, the new session inherits 0-25 and drops 26-29.

## Progress Wiki and Memory

Each Play Session owns an independent Progress Wiki. The Progress Wiki is a long-term memory document library summarizing durable facts, plot progress, character changes, world changes, unresolved threads, relationships, timeline details, items, and other session-specific state.

Conversation Log remains the raw fact source. Progress Wiki is a curated, editable long-term memory view derived from stable ranges of the Conversation Log.

The Progress Wiki uses cumulative Wiki Snapshots. A Wiki Snapshot is a complete Progress Wiki as of a Memory Boundary. In the MVP, memory curation can run every N conversation positions and deliberately summarize only content older than the mutable recent range. For example, at position 50 with a 10-position cadence, the system may create a snapshot for 0-40 while positions 41-50 remain raw recent context.

When forking at position 25 with snapshots at 0-10 and 0-20, the new session inherits the latest snapshot not exceeding the fork point, plus raw Conversation Log up to 25. Later source records are discarded.

Automatic Wiki Curation is allowed by default for authorized memory-focused agents. It does not require per-update user approval because Progress Wiki belongs to one Play Session and can be inspected, corrected, or restored through Wiki Snapshots. Story Material changes have a stricter review boundary because Story Material is shared across sessions.

## Context Assembly

A Context Pack is the assembled input for an agent inference step. It may include recent selected-path conversation turns, relevant Progress Wiki entries, applicable Wiki Snapshot content, Story Material, selected World Entries, player-character material if present, upstream Agent Output, and task instructions.

World Entries can enter a Context Pack through Entry Inclusion Modes:

- always included
- explicit keyword or trigger matching
- semantic retrieval
- manually disabled

This preserves SillyTavern-style world book triggers while allowing semantic retrieval for native Story Material.

## Orchestration

An Orchestration Configuration is an independent, reusable saved arrangement of agents and responsibilities. It is not bound to a Story. Story-specific behavior belongs in Story Material, World Entries, or agent-readable instructions included through context.

Each play turn runs one Generation Workflow using the currently selected Orchestration Configuration. Switching configurations affects future turns only and does not need to be recorded in the Play Session.

MVP workflows are Linear Workflows: Agent Assignments run in a user-configured sequence such as A -> B -> C. The Multi-Agent Scheduler passes each Agent Output to later steps. Agent Output is treated as a string at the system level; the system does not enforce structured fields. If users want JSON-like output, they define that in the agent instructions or Skill.

Each Agent Assignment can define:

- Agent Role
- instructions
- Skill Set
- model/provider override
- timeout
- execution order
- allowed tools

The current implementation loads the active play workflow from repo-local files under `user_data/`. `user_data/config.yaml` names the workflow and ordered agent ids; `user_data/agents/<agent-id>/agent.yaml` defines each agent. The Web UI configuration remains useful for management and future selection, but advanced agent/runtime tuning is file-first.

Each Agent Assignment has an Agent Timeout. If an agent fails or times out, the Generation Workflow fails and produces no Reply Variant. Failed workflow attempts do not enter the Conversation Log.

Workflow Traces are kept separately for diagnostics. The Trace Viewer exposes agent inputs, outputs, timing, and failures for configuration and debugging.

## Agent Architecture Layers

The architecture has three layers:

- Agent Runtime: runs agents against LLM providers and supports conversations, tool calls, skills, and subagent calls. pi-agent can be used here if it fits these requirements.
- Multi-Agent Scheduler: coordinates Agent Assignments, linear execution, subagent work, and handoff between steps inside a Generation Workflow.
- Role-Play Domain: owns Stories, Play Sessions, Conversation Logs, Progress Wikis, Story Material, Context Packs, Reply Variants, and player-facing behavior.

pi-agent should be treated as an Agent Runtime candidate or adapter, not as the source of the Role-Play Domain model.

## Skills, Tools, and Subagents

A Tool is a callable capability exposed through the Agent Runtime. Tool sources can include built-in local capabilities, user-provided MCP configuration, web search through MCP, or other external APIs.

A Skill is a reusable task method available to an Agent Assignment. A Skill can describe how to perform a job and may use one or more Tools. Skills are not just tool lists.

File-defined skills use the standard skill layout: `skills/<skill-id>/SKILL.md` is the prompt entrypoint and begins with frontmatter containing `name` and `description`. Agent skill folders live under `user_data/agents/<agent-id>/skills/`.

Each Agent Assignment has a Skill Set. External tools such as web search are optional and configured by the user, typically through MCP. The core MVP should not require network access for normal play.

Subagents are short-lived helper agents spawned by an Agent Assignment for parallel work within one inference step. MVP subagents are limited to one level below the spawning agent. Subagents receive read-only context and return Subagent Results such as findings, drafts, candidates, or recommendations. They cannot directly modify Conversation Log, Progress Wiki, Story Material, or other persistent state.

Progress Wiki reads, edits, and snapshots are governed through a Progress Wiki Skill rather than exposed as unrestricted generic tools. Story Material changes from agents go through a Story Material Write Tool that creates Story Material Proposals requiring user review before they affect the shared Story.

## SillyTavern Compatibility

SillyTavern is an import format, not the internal domain model.

The MVP supports:

- SillyTavern Character Import for common character card JSON or PNG metadata
- SillyTavern World Import for world/lorebook JSON

Imported files and metadata are preserved as Imported Assets for compatibility and traceability. The system converts imported data into native Character Profiles and World Entries for use by context assembly and agents.

The MVP does not support exporting back to SillyTavern.

## Web UI Workspaces

The MVP Web UI contains these workspaces:

- Story Library: list, create, import, and open Stories
- Play Workspace: play a Story through Play Sessions, switch sessions, select Orchestration Configurations, reroll Reply Variants, and create Session Forks
- Story Material Editor: edit Character Profiles, World Entries, fixed Story Material, and Imported Asset mappings
- Progress Wiki Editor: inspect and manually correct a Play Session Progress Wiki and snapshots
- Orchestration Builder: configure Agent Assignments, order, instructions, Skill Sets, timeouts, models, providers, and allowed tools
- Trace Viewer: inspect Workflow Traces for debugging and tuning

## Storage Decision

SQLite is the primary local store. It stores Stories, Play Sessions, Conversation Logs, Reply Variants, Selected Paths, Wiki Snapshots, Story Material, Imported Assets, Orchestration Configurations, and Workflow Traces.

All local runtime configuration and mutable runtime data lives under `user_data/` in the repo. The default SQLite path is `user_data/novel-agent.db`; provider auth/model config is under `user_data/providers/`; file-defined agents and skills are under `user_data/agents/`. Story and save directories are created under `user_data/stories/<story-id>/saves/<session-id>/wiki/`; current Progress Wiki document content remains SQLite-backed until the file-backed wiki writer is added.

JSONL may be used for import, export, backup, and interchange, but not as the authoritative application database. This is recorded in ADR 0001.

## MVP Non-Goals

The MVP explicitly does not include:

- multiplayer or shared sessions
- user accounts or authentication
- cloud sync or hosted multi-tenant deployment
- SillyTavern export
- full SillyTavern chat/group/plugin migration
- public role/card marketplace
- Village Mode
- arbitrary graph workflows beyond user-configured linear workflows
- system-enforced structured output schemas for agent steps
- automatic Story Material mutation without user review
