# Novel Agent MVP PRD

## Problem Statement

Text role-play users can already import character cards and lorebooks into tools like SillyTavern, but those tools are mostly chat-first and do not provide a configurable multi-agent writing team, durable session memory, inspectable agent traces, or clean management of forks, rerolls, and multiple story saves.

Novel Agent should let a single local user create or import role-play Stories, play isolated Play Sessions, configure reusable multi-agent Generation Workflows, and maintain long-term session memory without losing the raw Conversation Log or contaminating other sessions.

## Solution

Build a single-user local Web UI backed by SQLite. The MVP lets the user manage Stories, import SillyTavern character cards and world books, create and switch Play Sessions, play through a chat-like Play Workspace, reroll the latest Narrative Response as Reply Variants, fork older Conversation Positions into new Play Sessions, and inspect or correct Progress Wiki memory.

The system provides reusable Orchestration Configurations made from linear Agent Assignments. Each play turn runs a Generation Workflow through the selected configuration. Agents receive Context Packs, produce string Agent Output, may use configured Skill Sets and Agent-Facing Tools, and may spawn one level of read-only Subagents. Workflow Traces are stored separately from the Conversation Log and shown in a Trace Viewer for debugging.

## User Stories

1. As a role-play user, I want to create a Story, so that I can define a reusable role-play setting.
2. As a role-play user, I want to import a SillyTavern character card, so that I can reuse existing character material.
3. As a role-play user, I want to import a SillyTavern world book, so that I can reuse existing lore and trigger rules.
4. As a role-play user, I want imported files preserved as Imported Assets, so that I can trace where converted Story Material came from.
5. As a role-play user, I want imported character cards converted into Character Profiles, so that agents can use them natively.
6. As a role-play user, I want imported world books converted into World Entries, so that context assembly can retrieve them.
7. As a role-play user, I want to edit Character Profiles, so that I can refine Player Characters and Non-Player Characters.
8. As a role-play user, I want to edit World Entries, so that I can maintain locations, factions, rules, history, and situational facts.
9. As a role-play user, I want World Entries to support always-on, trigger-based, semantic, and disabled inclusion modes, so that story material enters context predictably.
10. As a role-play user, I want a Player Character to be optional, so that I can play with or without a structured self-character.
11. As a role-play user, I want multiple Stories in a Story Library, so that I can switch between different worlds.
12. As a role-play user, I want multiple Play Sessions under one Story, so that I can keep separate saves.
13. As a role-play user, I want Play Sessions to be isolated, so that divergent playthroughs do not contaminate each other.
14. As a role-play user, I want to switch between Play Sessions, so that I can resume different saves.
15. As a role-play user, I want each Play Session to keep a raw Conversation Log, so that the original play history is preserved.
16. As a role-play user, I want each generated system response to be a Narrative Response, so that the UI presents one coherent text output per turn.
17. As a role-play user, I want to reroll the latest system response, so that I can choose a better continuation.
18. As a role-play user, I want all Reply Variants saved, so that I can compare alternatives.
19. As a role-play user, I want only the latest system response to be mutable in place, so that history remains coherent.
20. As a role-play user, I want switching an older variant to create a Session Fork, so that old choices do not rewrite later events.
21. As a role-play user, I want to fork from a Conversation Position, so that I can branch into a new save.
22. As a role-play user, I want a fork to inherit history only through the selected position, so that later source-session events are discarded.
23. As a role-play user, I want each Play Session to have its own Progress Wiki, so that long-term memory follows the session branch.
24. As a role-play user, I want Progress Wiki content to be editable, so that I can correct bad memory curation.
25. As a role-play user, I want Progress Wiki Snapshots, so that memory can be restored or inherited safely during forks.
26. As a role-play user, I want memory curation to happen only behind a stable Memory Boundary, so that rerolls and recent edits do not pollute long-term memory.
27. As a role-play user, I want the Progress Wiki to be a document library with retrieval metadata, so that it remains flexible and searchable.
28. As a role-play user, I want automatic wiki curation, so that long sessions stay coherent without manual summarization every turn.
29. As a role-play user, I want Story Material changes proposed by agents to require review, so that shared story settings are not silently changed.
30. As a role-play user, I want reusable Orchestration Configurations, so that I can use the same writing team across different Stories.
31. As a role-play user, I want to switch Orchestration Configurations between turns, so that I can experiment with different writing workflows.
32. As a role-play user, I want MVP workflows to be linear, so that agent order is understandable and debuggable.
33. As a role-play user, I want to configure each Agent Assignment, so that I can control role, instructions, skills, model, provider, timeout, and allowed tools.
34. As a role-play user, I want global Model Defaults, so that simple configurations do not repeat provider settings.
35. As a role-play user, I want per-agent Model Overrides, so that expensive or specialized models can be used only where needed.
36. As a role-play user, I want each agent to have a Skill Set, so that agents have bounded capabilities.
37. As a role-play user, I want Skills to describe task methods, so that agents can follow reusable processes rather than only call raw tools.
38. As a role-play user, I want optional external tools through MCP configuration, so that web search or other APIs can be enabled when needed.
39. As a role-play user, I want core play to work without external tools, so that local role-play does not depend on network services.
40. As a role-play user, I want agents to spawn one level of Subagents, so that a main agent can parallelize research, drafting, or checks.
41. As a role-play user, I want Subagents to be read-only, so that parallel helper work cannot corrupt state.
42. As a role-play user, I want Subagent Results returned only to the spawning agent, so that main agents remain responsible for synthesis.
43. As a role-play user, I want a Generation Workflow to fail if an agent fails or times out, so that broken output is not silently accepted.
44. As a role-play user, I want failed workflows excluded from the Conversation Log, so that the play history only contains story-relevant events.
45. As a role-play user, I want Workflow Traces, so that I can inspect what each agent received and produced.
46. As a role-play user, I want a Trace Viewer, so that I can debug prompts, skills, tools, models, and timeouts.
47. As a role-play user, I want an Orchestration Builder, so that I can create and manage writing-team configurations.
48. As a role-play user, I want a Story Material Editor, so that I can manage characters, world entries, and imported mappings.
49. As a role-play user, I want a Progress Wiki Editor, so that I can inspect and repair session memory.
50. As a role-play user, I want a Play Workspace, so that I can play, reroll, fork, switch sessions, and choose orchestration configurations in one place.
51. As a role-play user, I want a Story Library, so that I can manage all Stories from a single entry point.
52. As a developer, I want the Role-Play Domain independent from the Agent Runtime, so that pi-agent or another runtime can be adapted without rewriting product concepts.
53. As a developer, I want SQLite as the primary local store, so that forks, variants, snapshots, retrieval metadata, and migrations are manageable.
54. As a developer, I want JSONL reserved for import, export, backup, or interchange, so that the authoritative application state remains queryable.

## Implementation Decisions

- The MVP is a Single-User Local App with no accounts, authentication, cloud sync, or multi-user permissions.
- The primary interface is a Web UI with Story Library, Play Workspace, Story Material Editor, Progress Wiki Editor, Orchestration Builder, and Trace Viewer.
- SQLite is the authoritative local store, as recorded in ADR 0001. JSONL is not the primary database.
- Story Material is shared by all Play Sessions under a Story. Progress Wiki is owned by one Play Session.
- Conversation Log is the raw source of session history. Progress Wiki is derived, curated, editable long-term memory.
- Reply Variants are all persisted. Runtime context follows the Selected Path.
- Only the Mutable Tail can be rerolled or switched in place. Older variant changes require Session Fork.
- Session Fork copies the selected prefix through the chosen Conversation Position and excludes later source-session records.
- Wiki Snapshots are cumulative full views as of a Memory Boundary, not only incremental fragments.
- Automatic Wiki Curation is allowed for authorized memory agents and does not require per-update approval.
- Story Material changes proposed by agents become Story Material Proposals and require user review before affecting the shared Story.
- Orchestration Configurations are reusable and independent of Stories.
- MVP Generation Workflows are Linear Workflows configured by the user.
- Agent Output is a string at the system level. The system does not enforce structured output schemas.
- Each Agent Assignment can configure role, instructions, Skill Set, timeout, provider/model override, order, and allowed tools.
- Model Defaults apply globally unless an Agent Assignment defines a Model Override.
- Agent failure or timeout fails the current Generation Workflow and produces no Reply Variant.
- Workflow Traces are stored separately from Conversation Log.
- Subagents are limited to one level, receive read-only context, and return Subagent Results to their spawning agent only.
- The architecture is layered into Agent Runtime, Multi-Agent Scheduler, and Role-Play Domain.
- pi-agent may be used as the Agent Runtime if it supports provider abstraction, multi-turn agent execution, tool calls, skills, and one-level subagents. It must not define the Role-Play Domain model.
- External tools such as web search are enabled through user-provided MCP configuration. Core play should not require external tools.
- SillyTavern support is import-only for character cards and world/lorebook JSON in the MVP.

## Testing Decisions

Good MVP tests should verify user-visible behavior and durable domain rules rather than implementation details. The most valuable seams are high-level application services or API boundaries that exercise persistent state transitions.

The recommended test seams are:

- Story management: creating Stories, importing SillyTavern assets, converting them into Story Material, and preserving Imported Assets.
- Play session management: creating sessions, switching sessions, appending conversation records, saving Reply Variants, selecting variants, and enforcing Mutable Tail rules.
- Forking: creating Session Forks from a Conversation Position, inheriting the correct selected-path prefix, dropping later records, and selecting the correct Wiki Snapshot.
- Progress Wiki: creating cumulative Wiki Snapshots at Memory Boundaries, preserving session isolation, and allowing manual edits.
- Context assembly: selecting recent conversation, Progress Wiki material, Story Material, World Entries by Entry Inclusion Mode, and optional Player Character material.
- Orchestration: executing a Linear Workflow, passing Agent Output downstream as strings, honoring timeouts, producing Workflow Traces, and excluding failures from Conversation Log.
- Tool and skill permissions: ensuring Subagents cannot write persistent state, Story Material Write Tool creates proposals, and Progress Wiki mutation is governed by Progress Wiki Skill behavior.
- Web UI flows: smoke-test the six MVP workspaces and their core navigation.

Because the repository currently contains only planning documents, there is no prior test framework to reuse yet. When implementation starts, prefer tests at the highest stable boundary: API route, service, or workflow boundary before lower-level unit tests.

## Out of Scope

- Multiplayer or shared sessions.
- User accounts, authentication, authorization, or cloud sync.
- Hosted multi-tenant deployment.
- SillyTavern export.
- Full SillyTavern chat, group chat, extension, plugin, regex script, or prompt preset migration.
- Public character/world marketplace.
- Village Mode where one agent independently plays one NPC.
- Arbitrary graph/DAG workflows beyond MVP Linear Workflows.
- System-enforced structured output schemas for agent steps.
- Automatic Story Material mutation without user review.
- Mandatory web search or network-dependent play.
- Complex automatic workflow recovery beyond direct failure on agent error or timeout.

## Further Notes

The design source of truth is `docs/novel-agent-design.md`. Domain vocabulary is maintained in `docs/glossary.md`. The SQLite storage decision is captured in `docs/adr/0001-sqlite-primary-storage.md`.

A later implementation plan should split this PRD into vertical slices rather than building all infrastructure first. A good first slice is: create a Story, create a Play Session, configure a minimal one-agent Orchestration Configuration, send one player message, generate one Narrative Response, persist it as a Reply Variant, and show a Workflow Trace.
