# Architecture

## Product Overview

Novel Agent is a local single-user Web UI for single-player text role-play. A user can import or create stories, manage play sessions under each story, chat inside a session, reroll the latest system response, fork older positions into new sessions, and inspect workflow traces.

The app is currently an MVP. SQLite is the authoritative structured store. `user_data/` is the repo-local runtime data root for database files, provider configuration, agent files, and ignored mutable story/save folders.

## Tech Stack

| Area | Choice |
| --- | --- |
| UI | Next.js App Router, React 19 |
| Server actions | Next.js server actions in `src/app/*-actions.ts` |
| Database | SQLite through libSQL client |
| ORM/migrations | Drizzle ORM and generated migrations in `drizzle/` |
| Tests | Vitest service tests, Playwright e2e tests |
| Agent runtime | `@earendil-works/pi-coding-agent` adapter plus deterministic stub runtime |
| Runtime config | `user_data/config.yaml`, `user_data/agents/*`, `user_data/providers/*` |

## Major Modules

| Module | Path | Responsibility |
| --- | --- | --- |
| Web UI | `src/app/` | Story library, story workspace, panels, forms, server actions |
| DB | `src/db/` | Schema, client, migration runner |
| Story services | `src/services/story-*` | Story CRUD, material, SillyTavern draft creation |
| Session service | `src/services/session-service.ts` | Play sessions, transcript, player turns, rerolls, forks |
| Context assembly | `src/services/context-assembly-service.ts` | Builds context packs from story material, world entries, recent chat, wiki |
| Orchestration | `src/services/orchestration-service.ts` | Runs file-defined linear multi-agent workflow and records traces |
| Agent runtime | `src/services/agent-runtime/` | Repo-local runtime config, Pi adapter, stub runtime |
| Progress Wiki | `src/services/progress-wiki-service.ts` | Session-owned wiki docs and cumulative snapshots, currently SQLite-backed |
| Trace service | `src/services/trace-service.ts` | Reads workflow trace details for UI |
| User data storage | `src/services/user-data-storage.ts` | Creates repo-local story/save/wiki directories |

## Runtime Data Layout

```text
user_data/
  config.yaml
  novel-agent.db
  providers/
    models.json
    auth.json
  agents/
    <agent-id>/agent.yaml
    <agent-id>/system.md
    <agent-id>/skills/<skill-id>/SKILL.md
    <agent-id>/prompts/
  stories/<story-id>/saves/<session-id>/wiki/
  lorebooks/
```

Tracked files under `user_data/` are seed config and sample agents. Databases, auth, stories, and lorebooks are ignored.

## Request And State Flow

There is no account system and no network auth boundary. Browser forms submit to server actions. Server actions validate input through service-layer schemas and write to SQLite. Play generation calls the orchestration service, which assembles context, reads repo-local workflow config, runs agents sequentially, records workflow trace steps, and appends the final response as a reply variant.

## Trust Boundaries

| Boundary | Current behavior | Risk |
| --- | --- | --- |
| Browser to server actions | Server-side services validate IDs and ownership relationships such as session belongs to story. | Single-user assumption means no user identity checks exist. |
| Server to SQLite | Services own all writes. | No database row-level security; correctness depends on service checks and tests. |
| Server to Pi/provider | Pi runtime may call an external LLM provider when `NOVEL_AGENT_RUNTIME=pi`. | Prompt/context may include imported story content and conversation history. |
| Agent to app state | Agents return text; app services decide what to persist. | Future tools must keep mutation guardrails outside prompts. |
| Local filesystem | `user_data/` stores provider auth and mutable local data. | Local filesystem access equals app data access. |

## Known Risks And Assumptions

- No account system: all data is local and owned by one user.
- Provider credentials are local secrets in `user_data/providers/auth.json` or provider env vars; the Web UI does not manage secrets.
- Progress Wiki content is currently stored in SQLite. The filesystem wiki directory is created but not yet the source of wiki document content.
- The active play workflow is file-defined under `user_data/config.yaml`; UI orchestration configuration remains useful for management and future selection, but not yet the primary runtime selector.
- `next build` may emit a Turbopack dynamic filesystem tracing warning from runtime config loading. The build and e2e tests pass.
- External tool/MCP execution is not yet wired into the core play loop.

## Related Documents

- `README.md` - install, run, command surface, project map
- `AGENTS.md` - coding-agent operating context
- `CONTRIBUTING.md` - contribution workflow
- `docs/technical-architecture.md` - deeper target architecture
- `docs/novel-agent-design.md` - product/domain design notes
- `documentation/flows.md` - side-effect and trust-boundary flows
- `documentation/permissions.md` - permissions and resource operation matrix
- `documentation/variables.md` - variables and secrets
- `documentation/tests.md` - coverage map and gaps
- `documentation/automation.md` - embedded agent workflow map

No email system: no `emails.md`.
No scheduled jobs: no `cron.md`.
No public SEO surface beyond a local app shell: no `seo.md`.
