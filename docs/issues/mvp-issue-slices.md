# Novel Agent MVP Issue Slices

These issues break `docs/mvp-prd.md` into tracer-bullet vertical slices. Each slice should be independently demoable or verifiable after its blockers are complete.

## 1. Bootstrap Local Web App + SQLite Store

## What to build

Create the local Web UI application skeleton with SQLite-backed persistence and a minimal app shell. The slice should establish the project shape, migration path, configuration loading, and a first smoke-testable route/page so later slices can add real domain behavior.

## Acceptance criteria

- [ ] The app can be started locally and opens a Web UI shell.
- [ ] SQLite is initialized through a repeatable migration path.
- [ ] The app has a durable place to store domain data and runtime configuration.
- [ ] A smoke test or equivalent verification proves the app boots against a test database.

## Blocked by

None - can start immediately.

## User stories covered

52, 53, 54

## 2. Story Library: Create and Open Stories

## What to build

Let the user create Stories, list existing Stories in the Story Library, and open one Story into its workspace. This should prove the basic Story lifecycle through schema, API/service, UI, and tests.

## Acceptance criteria

- [ ] A user can create a Story with a name and basic description.
- [ ] Story Library lists persisted Stories after reload.
- [ ] A user can open a Story from the list.
- [ ] Tests cover Story creation and listing through the highest available application boundary.

## Blocked by

- 1. Bootstrap Local Web App + SQLite Store

## User stories covered

1, 11, 51

## 3. Story Material Editor: Characters and World Entries

## What to build

Add native Story Material editing for Character Profiles, World Entries, Entry Inclusion Mode, and optional Player Character selection. This should make a Story usable without imports.

## Acceptance criteria

- [ ] A user can create, edit, and delete Character Profiles under a Story.
- [ ] A user can mark a Character Profile as the optional Player Character or leave it unset.
- [ ] A user can create, edit, and delete World Entries.
- [ ] A World Entry supports always, triggered, semantic, and disabled inclusion modes.
- [ ] Tests cover Story Material persistence and Player Character optionality.

## Blocked by

- 2. Story Library: Create and Open Stories

## User stories covered

7, 8, 9, 10, 48

## 4. SillyTavern Import: Character Cards and World Books

## What to build

Import SillyTavern character cards and world/lorebook JSON into a Story. Preserve original Imported Assets and convert them into native Character Profiles and World Entries.

## Acceptance criteria

- [ ] A user can import a common SillyTavern character card JSON or PNG metadata payload.
- [ ] Imported character card data is preserved as an Imported Asset.
- [ ] Imported character card data creates or updates a Character Profile.
- [ ] A user can import a SillyTavern world/lorebook JSON file.
- [ ] Imported world book data is preserved as an Imported Asset and converted to World Entries.
- [ ] Tests cover conversion and preservation behavior for representative fixtures.

## Blocked by

- 3. Story Material Editor: Characters and World Entries

## User stories covered

2, 3, 4, 5, 6

## 5. Play Workspace: Sessions and First Narrative Response

## What to build

Create the first playable loop. The user can create and switch Play Sessions, enter one player message, run a minimal one-agent Generation Workflow, and persist one Narrative Response as a Reply Variant in the Conversation Log.

## Acceptance criteria

- [x] A user can create multiple Play Sessions under one Story.
- [x] A user can switch between Play Sessions without shared Conversation Logs.
- [x] A user can send one player message in the Play Workspace.
- [x] A file-defined Generation Workflow produces one final Narrative Response.
- [x] The player message and generated Reply Variant persist after reload.
- [x] Tests cover session isolation and first-turn persistence.

## Blocked by

- 2. Story Library: Create and Open Stories
- 3. Story Material Editor: Characters and World Entries

## User stories covered

12, 13, 14, 15, 16, 30, 32, 39, 50

## 6. Orchestration Builder: Linear Agent Configuration

## What to build

Let the user create reusable Orchestration Configurations composed of linear Agent Assignments. The builder should support role, instructions, Skill Set, model defaults/overrides, timeout, order, and allowed tools.

## Acceptance criteria

- [x] A user can create and delete an Orchestration Configuration. Edit/duplicate remain future UI work.
- [x] A user can add ordered Agent Assignments to a configuration.
- [x] File-defined agents under `user_data/agents/*` can configure instructions, standard `SKILL.md` skills, timeout, provider/model settings, and allowed tools.
- [x] Global Model Defaults apply when an agent has no override.
- [x] Tests cover configuration persistence and file-defined workflow ordering.

## Blocked by

- 1. Bootstrap Local Web App + SQLite Store

## User stories covered

30, 31, 32, 33, 34, 35, 36, 37, 47

## 7. Workflow Trace Viewer and Failure Handling

## What to build

Record Workflow Traces for Generation Workflow attempts and expose them through a Trace Viewer. If an agent fails or times out, the workflow fails without writing a Reply Variant or story-visible Conversation Log entry.

## Acceptance criteria

- [x] Successful workflow attempts record step inputs, outputs, timings, selected configuration, and final result.
- [x] Failed workflow attempts record failure details.
- [x] Failed workflows do not append a Reply Variant or Narrative Response to the Conversation Log.
- [x] Trace Viewer lets the user inspect workflow attempts for a Play Session.
- [x] Tests cover trace recording and failure exclusion from Conversation Log.

## Blocked by

- 5. Play Workspace: Sessions and First Narrative Response
- 6. Orchestration Builder: Linear Agent Configuration

## User stories covered

43, 44, 45, 46

## 8. Reply Variants and Mutable Tail Reroll

## What to build

Support rerolling the latest system response. Store all Reply Variants at the Mutable Tail and let the user switch the Selected Variant before continuing.

## Acceptance criteria

- [ ] A user can generate another Reply Variant for the latest system response.
- [ ] The UI lets the user navigate variants at the Mutable Tail.
- [ ] All variants are persisted.
- [ ] The Selected Path follows the currently selected latest variant when the next user message is sent.
- [ ] Tests cover variant persistence, selection, and Mutable Tail restrictions.

## Blocked by

- 5. Play Workspace: Sessions and First Narrative Response

## User stories covered

17, 18, 19

## 9. Session Fork from Older Conversation Position

## What to build

Let the user create a Session Fork from an older Conversation Position or older Reply Variant. The fork must inherit the selected source prefix and discard later records.

## Acceptance criteria

- [ ] A user can choose an older Conversation Position and create a new Play Session from it.
- [ ] A user can fork from an older Reply Variant without mutating the source session.
- [ ] The new session inherits records only through the fork position.
- [ ] Later source-session records are not present in the fork.
- [ ] Tests cover fork inheritance for selected paths and older variants.

## Blocked by

- 8. Reply Variants and Mutable Tail Reroll

## User stories covered

20, 21, 22

## 10. Progress Wiki: Editor, Snapshots, and Memory Boundary

## What to build

Add session-owned Progress Wiki support with editable documents, cumulative Wiki Snapshots, and Memory Boundary-aware snapshot selection for forks.

## Acceptance criteria

- [ ] Each Play Session has an independent Progress Wiki.
- [ ] A user can view and edit Progress Wiki documents.
- [ ] The system can create a cumulative Wiki Snapshot at a Memory Boundary.
- [ ] Forking chooses the latest Wiki Snapshot that does not exceed the fork position.
- [ ] Tests cover session isolation, snapshot creation, and fork snapshot selection.

## Blocked by

- 5. Play Workspace: Sessions and First Narrative Response
- 9. Session Fork from Older Conversation Position

## User stories covered

23, 24, 25, 26, 27, 28, 49

## 11. Context Assembly with Story Material and Progress Wiki

## What to build

Build Context Pack assembly for Generation Workflows. It should combine recent selected-path conversation, Story Material, World Entries by Entry Inclusion Mode, optional Player Character material, and Progress Wiki content.

## Acceptance criteria

- [ ] Context assembly includes recent selected-path conversation turns.
- [ ] Context assembly includes optional Player Character material only when configured.
- [ ] World Entries are selected according to inclusion mode.
- [ ] Progress Wiki content can be included from the current Play Session.
- [ ] Tests cover context assembly for trigger-based, semantic, always, and disabled World Entries.

## Blocked by

- 3. Story Material Editor: Characters and World Entries
- 10. Progress Wiki: Editor, Snapshots, and Memory Boundary

## User stories covered

9, 23, 27, 28

## 12. Agent Tools, Skills, MCP Config, and Subagents

## What to build

Add the MVP capability model for Agent-Facing Tools, Skill Sets, user-provided MCP external tool configuration, read-only one-level Subagents, Progress Wiki Skill behavior, and Story Material Proposal review boundaries.

## Acceptance criteria

- [x] File-defined agents and database Agent Assignments can be granted a Skill Set and allowed Agent-Facing Tools.
- [ ] User-provided MCP configuration can expose optional external tools to selected Skill Sets.
- [x] A main agent can spawn one level of read-only Subagents and receive Subagent Results in the service model.
- [x] Subagents cannot write Conversation Log, Progress Wiki, or Story Material directly in the service model.
- [ ] Story Material Write Tool creates Story Material Proposals requiring user review.
- [ ] Progress Wiki mutation is only available through Progress Wiki Skill behavior.
- [x] Tests cover subagent read-only constraints and proposal review boundaries.

## Blocked by

- 6. Orchestration Builder: Linear Agent Configuration
- 7. Workflow Trace Viewer and Failure Handling
- 11. Context Assembly with Story Material and Progress Wiki

## User stories covered

29, 36, 37, 38, 40, 41, 42
