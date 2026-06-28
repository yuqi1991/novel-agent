# Flows

This document maps flows that cross trust boundaries, change durable state, or call automation/provider surfaces.

## Create Story Manually

| Field | Value |
| --- | --- |
| Actor | Local user |
| Preconditions | App running, database migrated |
| Success outcome | Story and default settings persisted; story data directory created |

Steps:

1. Browser submits create-story form to `createStoryAction`.
2. Server action calls `createStory`.
3. Service validates title/description with Zod.
4. Service inserts `stories` and `story_settings`.
5. Service creates `user_data/stories/<story-id>/saves/`.

Authz: no account-level auth. Service-level data integrity checks enforce valid input.

Side effects: SQLite writes, local directory creation.

## Import SillyTavern Character Or World

| Field | Value |
| --- | --- |
| Actor | Local user |
| Preconditions | User provides JSON payload |
| Success outcome | Imported asset, character profiles, and world entries are persisted |

Steps:

1. Browser submits pasted JSON to parse action.
2. Server parses payload through SillyTavern import service.
3. User reviews prefilled story draft in UI.
4. Browser submits draft to `createStoryFromDraftAction`.
5. Service validates draft arrays.
6. Service persists `imported_assets`, `character_profiles`, and `world_entries`.
7. Service creates the story directory under `user_data/stories/`.

Authz: single-user local assumption. Deny cases are invalid JSON, unsupported shape, blank story title, or invalid draft arrays.

Side effects: SQLite writes, raw imported payload stored in SQLite.

## Send Player Message

| Field | Value |
| --- | --- |
| Actor | Local user |
| Preconditions | Story exists; active session exists or is created |
| Success outcome | Player message, system response position, reply variant, and workflow trace are persisted |

Steps:

1. Browser submits chat message to `submitPlayerMessageAction`.
2. `submitPlayerMessage` validates story/session/message.
3. Service verifies session belongs to story.
4. Service appends a player `conversation_positions` row and `player_messages` row.
5. `runGenerationWorkflow` assembles context.
6. Orchestration loads `user_data/config.yaml` and file-defined agents.
7. Each configured agent runs through stub or Pi runtime.
8. Each agent step is recorded in `workflow_trace_steps`.
9. Final agent output is stored as a new `reply_variants` row and selected on the system response position.

Authz: `assertSessionBelongsToStory` protects story/session consistency. Deny cases include missing session, wrong story/session pair, blank message, runtime failure.

Trust-boundary crossings: browser to server action; server to SQLite; server to Pi/provider if `NOVEL_AGENT_RUNTIME=pi`.

Side effects: SQLite writes; possible external provider call; workflow trace capture.

Failure behavior: if generation fails, the player turn is removed and no reply variant is appended.

## Reroll Latest Reply

| Field | Value |
| --- | --- |
| Actor | Local user |
| Preconditions | Latest conversation position is a system response |
| Success outcome | New reply variant persisted and selected at mutable tail |

Steps:

1. Browser submits reroll action.
2. Service verifies session belongs to story.
3. Service checks the mutable tail is a system response.
4. Service finds the preceding player message.
5. Orchestration reruns workflow with incremented variant index.
6. New variant is inserted and selected.

Authz/data checks: only latest system response can be mutated. Deny cases include empty session, latest position not system response, wrong story/session pair.

Side effects: SQLite writes; possible external provider call.

## Fork Session

| Field | Value |
| --- | --- |
| Actor | Local user |
| Preconditions | Source session and fork position belong to selected story |
| Success outcome | New session contains copied transcript prefix and eligible wiki snapshot |

Steps:

1. Browser submits fork action with source session, fork position, optional variant.
2. Service verifies source session belongs to story.
3. Service validates fork position and optional reply variant.
4. Service creates target play session.
5. Service copies conversation positions, player messages, and reply variants up to the fork point.
6. Progress Wiki service copies the latest eligible cumulative snapshot.
7. Service creates `user_data/stories/<story-id>/saves/<new-session-id>/wiki/`.

Authz/data checks: source session must belong to story; variant must belong to fork system position; player-message positions cannot fork from a variant.

Side effects: SQLite writes, local directory creation.

## Edit Progress Wiki

| Field | Value |
| --- | --- |
| Actor | Local user |
| Preconditions | Session exists |
| Success outcome | Session-owned wiki document is created, updated, deleted, or snapshotted |

Steps:

1. Browser submits progress-wiki form action.
2. Server action calls progress wiki service.
3. Service validates session/document IDs and document fields.
4. Service writes `progress_wiki_documents` or `wiki_snapshots`.

Authz/data checks: document updates/deletes require document ID and session ID match.

Side effects: SQLite writes. Filesystem wiki directory exists but document content is not file-backed yet.
