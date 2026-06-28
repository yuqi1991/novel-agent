# Novel Agent

This context defines the product language for a single-player, agent-driven text role-play framework. It exists to keep story creation, imported role-play assets, game sessions, and agent orchestration concepts distinct.

## Language

**Story**:
A playable role-play setting owned by the user, containing the background, cast, and world material shared by its play sessions.
_Avoid_: Campaign, project, chat

**Play Session**:
An isolated game save under a Story, containing the conversation history and evolved state for one branch of play.
_Avoid_: Chat, save file, thread

**Session Fork**:
A new Play Session created from a specific point in an existing Play Session history.
_Avoid_: Copy, branch, duplicate

**Player Character**:
The character the user performs as while playing a Story.
_Avoid_: User, protagonist, main character

**Non-Player Character**:
A character in a Story that is performed by the system rather than by the user.
_Avoid_: Bot, assistant, AI character

**Orchestration Configuration**:
A reusable saved arrangement of agents and their responsibilities that can be selected during play across different Stories.
_Avoid_: Preset, workflow, pipeline

**Conversation Log**:
The complete ordered record of messages and system events in a Play Session, treated as the raw source of what happened in that branch.
_Avoid_: Transcript, chat history

**Progress Wiki**:
A Play Session-owned long-term memory library summarizing durable facts, plot progress, character changes, and world changes extracted from that session's Conversation Log.
_Avoid_: Memory, summary, lorebook

**Context Pack**:
The assembled information given to an agent for one inference step, such as recent conversation turns, relevant Progress Wiki entries, Story material, and task instructions.
_Avoid_: Prompt, context window, retrieval result

**Memory Boundary**:
The highest conversation position that has been incorporated into a Progress Wiki snapshot and is considered stable for long-term memory.
_Avoid_: Checkpoint, summarized until

**Wiki Snapshot**:
A complete versioned Progress Wiki as of a Memory Boundary, used to restore or fork a Play Session without carrying memory from later conversation positions.
_Avoid_: Backup, wiki version, memory checkpoint

**Conversation Position**:
A numbered point in a Play Session conversation used as the target for rewind, reroll, memory boundaries, and session forks.
_Avoid_: Floor, turn number, message index

**Fork Source Range**:
The prefix of a source Play Session inherited by a Session Fork, ending at the selected Conversation Position and excluding later conversation records.
_Avoid_: Fork history, copied messages

**Imported Asset**:
An original external file or metadata payload brought into the system and preserved for compatibility, traceability, or export.
_Avoid_: Source file, upload

**Story Material**:
Native structured material belonging to a Story, derived from imports or created by the user, and used by agents during play.
_Avoid_: Lore, content, data

**Character Profile**:
Story Material that defines a Player Character or Non-Player Character, including identity, persona, behavioral constraints, and relevant presentation details.
_Avoid_: Character card, persona card

**World Entry**:
Story Material that describes a retrievable piece of world knowledge, such as locations, factions, rules, history, or situational facts.
_Avoid_: Lorebook entry, world book entry

**Agent Role**:
A built-in responsibility that an agent can perform within an Orchestration Configuration, such as plot direction, character performance, world simulation, memory curation, prose polishing, or retrieval.
_Avoid_: Agent type, worker type

**Agent Assignment**:
A configured instance of an Agent Role within an Orchestration Configuration, including its model, instructions, tools, skills, context strategy, and execution position.
_Avoid_: Agent node, step

**Skill Set**:
The bounded collection of skills available to an Agent Assignment while performing its role.
_Avoid_: Tool list, capability list

**Subagent**:
A short-lived helper agent spawned by an Agent Assignment to perform parallel work for one inference step, limited to one level below the spawning agent.
_Avoid_: Child agent, worker agent

**Subagent Result**:
A read-only contribution returned from a Subagent to its spawning Agent Assignment, such as findings, drafts, candidates, or structured recommendations.
_Avoid_: Subagent output, child result

**Reply Variant**:
One generated alternative for the latest system response at a Conversation Position, selectable by the user before continuing play.
_Avoid_: Candidate reply, reroll output, completion

**Selected Variant**:
The Reply Variant currently chosen as the active continuation for a Conversation Position.
_Avoid_: Accepted reply, committed reply

**Selected Path**:
The active sequence through a Play Session conversation, formed by the currently selected Reply Variant at each position that has variants.
_Avoid_: Main branch, active history

**Mutable Tail**:
The latest system response position in a Play Session where the user may switch or add Reply Variants without creating a Session Fork.
_Avoid_: Editable message, current reply

**Narrative Response**:
The single user-visible system reply for one play turn, presenting narration, dialogue, and consequences as one coherent text output.
_Avoid_: NPC message, assistant message

**Writing Team Mode**:
The MVP orchestration style where agents perform functional writing and reasoning roles rather than each agent independently embodying one character.
_Avoid_: Multi-character mode, village mode

**Village Mode**:
A future orchestration style where separate agents independently embody individual Non-Player Characters or world actors.
_Avoid_: NPC-per-agent mode

**Optional Player Character**:
A Player Character definition that may be absent from a Story or Play Session, in which case the user plays without structured player-character material.
_Avoid_: Empty user character, anonymous protagonist

**Player Agency Preference**:
A user-defined writing preference for how much the system may provide minor speech or reactions for the Player Character while avoiding turning-point or key decisions on the Player Character's behalf.
_Avoid_: Player agency boundary, user control, agency rule

**Workflow Run**:
One complete execution of an Orchestration Configuration to produce a Reply Variant for a single play turn.
_Avoid_: Inference run, generation job, turn execution

**Generation Workflow**:
One complete multi-agent execution for producing a Narrative Response from the current Play Session state and the currently selected Orchestration Configuration.
_Avoid_: Run, pipeline execution, turn execution

**Entry Inclusion Mode**:
The rule for whether a World Entry is included in a Context Pack, such as always included, explicit trigger-based, semantic retrieval-based, or manually disabled.
_Avoid_: Activation mode, insertion rule

**Memory Curation Skill**:
A skill available to a memory-focused Agent Assignment that defines how Conversation Log ranges are distilled into Progress Wiki updates.
_Avoid_: Summarization prompt, memory workflow

**Agent Runtime**:
The lowest execution layer that runs agents against LLM providers and supports conversations, tool calls, skills, and subagent calls.
_Avoid_: Agent framework, pi-agent core

**Multi-Agent Scheduler**:
The orchestration layer that coordinates Agent Assignments, message passing, execution order, and parallel work within a Generation Workflow.
_Avoid_: Workflow engine, coordinator

**Role-Play Domain**:
The product layer that owns Stories, Play Sessions, Story Material, Progress Wikis, Context Packs, and player-facing role-play behavior.
_Avoid_: Game logic, RP app layer

**Linear Workflow**:
A Generation Workflow shape where Agent Assignments run in a user-configured sequence, passing each step output to later steps through the Multi-Agent Scheduler.
_Avoid_: Chain, pipeline

**Agent Output**:
The string result produced by an Agent Assignment and passed by the Multi-Agent Scheduler to later steps without system-level schema enforcement.
_Avoid_: Structured output, result object

**Agent Timeout**:
The per-Agent Assignment time limit for completing its step in a Generation Workflow, after which the workflow fails.
_Avoid_: Step timeout, retry policy

**Workflow Failure**:
A Generation Workflow outcome where an Agent Assignment fails or times out and no Narrative Response is produced for that attempt.
_Avoid_: Error recovery, failed turn

**Workflow Trace**:
A diagnostic record of a Generation Workflow attempt, including agent steps, inputs, outputs, timing, and failures, kept separate from the Conversation Log.
_Avoid_: Conversation event, debug log

**Trace Viewer**:
A user-facing advanced view for inspecting Workflow Traces while configuring, testing, or debugging Orchestration Configurations.
_Avoid_: Debug panel, run inspector

**Web UI**:
The primary MVP user interface for managing Stories, Play Sessions, Orchestration Configurations, Progress Wikis, and play interaction.
_Avoid_: CLI, desktop client

**Single-User Local App**:
The MVP deployment model where one local user manages all Stories, Play Sessions, and configurations without accounts, authentication, or multi-user permissions.
_Avoid_: Multi-tenant app, cloud account

**Story Library**:
The Web UI workspace for listing, creating, importing, and opening Stories.
_Avoid_: Home page, project list

**Play Workspace**:
The Web UI workspace for playing a Story through Play Sessions, selecting Orchestration Configurations, rerolling Reply Variants, and creating Session Forks.
_Avoid_: Chat page, game screen

**Story Material Editor**:
The Web UI workspace for editing Character Profiles, World Entries, fixed Story material, and Imported Asset mappings.
_Avoid_: Lore editor, card editor

**Progress Wiki Editor**:
The Web UI workspace for viewing and manually correcting a Play Session Progress Wiki and its snapshots.
_Avoid_: Memory editor, summary viewer

**Orchestration Builder**:
The Web UI workspace for editing Orchestration Configurations, including Agent Assignments, order, instructions, Skill Sets, timeouts, models, and providers.
_Avoid_: Workflow builder, agent editor

**SillyTavern Character Import**:
An import path for common SillyTavern character card JSON or PNG metadata, preserved as an Imported Asset and converted into a Character Profile.
_Avoid_: Full character migration, card runtime

**SillyTavern World Import**:
An import path for SillyTavern world or lorebook JSON, preserved as an Imported Asset and converted into World Entries.
_Avoid_: Full SillyTavern migration, lorebook runtime

**Model Defaults**:
The global default LLM provider and model settings used by Agent Assignments unless they define their own overrides.
_Avoid_: Global model, default provider

**Model Override**:
An Agent Assignment-specific provider or model setting that replaces the Model Defaults for that agent step.
_Avoid_: Per-agent model, model config

**Tool**:
A callable capability available through the Agent Runtime, such as Story Material retrieval, Progress Wiki access, web search, MCP operations, or other external APIs.
_Avoid_: Skill, function

**Skill**:
A reusable task method available to an Agent Assignment that guides how to perform work and may rely on one or more Tools.
_Avoid_: Tool, prompt snippet

**External Tool Configuration**:
User-provided configuration that exposes optional external Tools, such as web search through MCP, to selected Skill Sets.
_Avoid_: Built-in web search, plugin config

**Agent-Facing Tool**:
A Tool exposed to Agent Assignments through Skill Sets, distinct from ordinary Web UI actions such as form submissions.
_Avoid_: UI action, backend endpoint

**Story Material Write Tool**:
An Agent-Facing Tool that allows an authorized Agent Assignment to propose or apply changes to Story Material.
_Avoid_: User editor, form save

**Progress Wiki Skill**:
A Skill that controls how an authorized Agent Assignment reads, edits, and snapshots a Play Session Progress Wiki.
_Avoid_: Wiki read tool, wiki write tool

**Story Material Proposal**:
A pending change to Story Material produced by an authorized Agent Assignment and requiring user review before it affects the shared Story.
_Avoid_: Automatic story update, draft edit

**Automatic Wiki Curation**:
The default behavior where an authorized memory-focused Agent Assignment updates a Play Session Progress Wiki without per-update user approval, constrained by Memory Boundaries and Wiki Snapshots.
_Avoid_: Manual memory approval, story material update
