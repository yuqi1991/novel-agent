# Coding Agent Guide

This file is the handoff entrypoint for coding agents working in this repo.

## First Read

1. `README.md` for setup and command surface.
2. `documentation/architecture.md` for the current implemented system map.
3. `docs/technical-architecture.md` for the deeper target architecture.
4. `docs/issues/mvp-issue-slices.md` for remaining work.

## Current Implementation Rules

- Keep all local runtime configuration and mutable app data under `user_data/`.
- Do not reintroduce dependencies on `~/.pi/agent` for this app.
- Do not hard-code workflow agent names in orchestration logic. Test/sample agents may exist as files under `user_data/agents/`.
- File-defined skills must use `skills/<skill-id>/SKILL.md` with `name` and `description` frontmatter.
- SQLite is the authoritative structured store for the current MVP.
- Conversation logs are raw fact source. Progress Wiki is derived, editable session memory.
- Progress Wiki content is currently SQLite-backed; `user_data/stories/<story-id>/saves/<session-id>/wiki/` exists as the reserved file-backed layout.
- Subagents are read-only helpers. They return results to their parent agent and cannot mutate app state directly.

## Validation Expectations

Run these after most code changes:

```bash
npm run typecheck
npm test
```

Run these before handing off UI, persistence, import, orchestration, or runtime changes:

```bash
npm run build
npm run test:e2e
```

`npm run build` may emit a Turbopack warning about dynamic filesystem tracing from runtime config loading. Treat failures as blockers; treat the warning as known technical debt unless your change touches runtime config loading.

## File Ownership Hints

- UI routes and panels: `src/app/`
- Server actions: `src/app/*-actions.ts`
- Database schema: `src/db/schema.ts`
- Migrations: `drizzle/`
- Story/session/chat logic: `src/services/session-service.ts`, `src/services/story-service.ts`
- SillyTavern import: `src/services/sillytavern-import-service.ts`, `src/services/story-creation-service.ts`
- Multi-agent workflow: `src/services/orchestration-service.ts`
- Runtime adapter: `src/services/agent-runtime/`
- Progress Wiki: `src/services/progress-wiki-service.ts`
- Trace viewer data: `src/services/trace-service.ts`

## Safety Notes

- Do not commit `user_data/providers/auth.json`, `user_data/*.db`, `user_data/stories/`, `user_data/lorebooks/`, `.env*`, `.next/`, `test-results/`, or private imported cards.
- The root `莉莉儿.json` file is a local manual-test fixture and is intentionally not tracked.
- Preserve user changes in dirty files unless explicitly told to revert them.
