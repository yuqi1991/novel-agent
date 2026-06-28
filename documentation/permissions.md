# Permissions

## Roles And Scope

Novel Agent currently has one implicit role: local user. There is no login, account, tenant, or remote authorization model.

Scope is derived from resource relationships in SQLite:

- A Play Session belongs to a Story through `play_sessions.story_id`.
- Conversation positions, player messages, reply variants, progress wiki docs, and wiki snapshots belong to a Play Session.
- Character profiles, world entries, settings, imported assets, and proposals belong to a Story.

The app relies on service-layer checks rather than database row-level security.

## Resource Operation Matrix

| Resource | Operation | Local user | Enforcement |
| --- | --- | --- | --- |
| Story | List/create/view | Allowed | Server actions and `story-service` validation |
| Story Material | Create/delete/update settings | Allowed | `story-material-service` validates story and profile/entry ownership |
| Imported Asset | Create through import | Allowed | `story-creation-service`, `sillytavern-import-service` validation |
| Play Session | Create/list/default | Allowed within story | `session-service` checks story exists |
| Play Session | Fork | Allowed if source belongs to story | `assertSessionBelongsToStory`, fork position checks |
| Conversation Log | Append player turn | Allowed if session belongs to story | `assertSessionBelongsToStory`; rollback on generation failure |
| Reply Variant | Reroll/select | Allowed only on latest system response | `getMutableTailSystemPosition` and variant ownership checks |
| Progress Wiki | Create/list/update/delete/snapshot | Allowed within session | `progress-wiki-service` session/document matching |
| Orchestration Configuration | Manage through UI | Allowed | Orchestration config service validation |
| File-defined Agents | Edit local files | Local filesystem owner only | Not mediated by Web UI |
| Provider Auth | Edit local secret file/env | Local filesystem owner only | Ignored by git; not exposed in Web UI |

## Agent Permissions

Agents can read assembled context passed by the app. In the current play loop, agents return text to the orchestration service. The app owns persistence.

Subagents are read-only helper calls in the service model. They return results to a parent agent and cannot directly write Conversation Log, Progress Wiki, or Story Material.

Future tool support must preserve this distinction:

- Agent output can suggest or draft.
- App services validate and persist.
- Shared Story Material mutations require proposal/review boundaries.
- Progress Wiki mutation should be governed through a dedicated Progress Wiki skill boundary.

## Deny Cases To Preserve

- A session ID from another story must not be accepted for a story-scoped action.
- Only the latest system response can change selected reply variant.
- Reroll requires a latest system response and preceding player message.
- Fork variant selection is only valid for a system response fork point.
- Progress Wiki document updates/deletes require document ID and session ID match.
