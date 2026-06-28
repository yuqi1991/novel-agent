# Novel Agent

Novel Agent is a local single-player, text role-play game framework. It imports SillyTavern character cards and world books, stores multiple stories and play sessions, and runs each player turn through a configurable multi-agent writing workflow.

The current MVP is a Next.js Web UI backed by SQLite. The default play workflow is file-defined under local git-ignored `user_data/` and runs two sample agents in sequence:

1. `plot-designer` plans the next beat.
2. `literary-writer` writes the final Chinese RP response.

## Current State

- Single-user local app, no account system.
- Story library with SillyTavern character/world import.
- Story workspace with chat, sessions, reroll variants, forks, story material, save manager, progress wiki panel, orchestration panels, and trace viewer.
- SQLite is the authoritative structured store.
- Agent runtime defaults to Pi outside tests and deterministic stub in tests.
- Agent definitions, skills, provider models, provider auth, and runtime data live under local `user_data/`, which is intentionally ignored by git.

## Requirements

- Node.js 22 or newer
- npm
- Playwright browsers for e2e tests:

```bash
npx playwright install
```

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:3000`.

For deterministic local play without provider credentials, keep:

```bash
NOVEL_AGENT_RUNTIME=stub
```

For real LLM-backed play, set:

```bash
NOVEL_AGENT_RUNTIME=pi
```

Then configure provider credentials with one local-only option:

1. Put credentials in `user_data/providers/auth.json`.
2. Set provider environment variables supported by Pi, such as `DEEPSEEK_API_KEY`.

`user_data/` is ignored by git. On first runtime load, the app creates a default `user_data/config.yaml`, `user_data/providers/models.json`, two sample agents, and an empty `user_data/providers/auth.json`.

For DeepSeek, the auth file shape is:

```json
{
  "deepseek": { "type": "api_key", "key": "sk-..." }
}
```

## Common Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run start        # Start production server after build
npm run typecheck    # TypeScript checks
npm test             # Vitest service/unit tests
npm run test:e2e     # Playwright e2e tests
npm run db:migrate   # Apply Drizzle migrations to the configured SQLite DB
npm run db:generate  # Generate a new Drizzle migration after schema changes
```

## Project Layout

```text
src/app/                 Next.js App Router UI and server actions
src/db/                  Drizzle schema, client, migration runner
src/domain/              Domain helpers
src/services/            Application services and tests
src/services/agent-runtime/
                          Pi runtime adapter, stub runtime, repo-local config loader
tests/e2e/               Playwright e2e tests
tests/fixtures/          Import fixtures
drizzle/                 Generated migrations
docs/                    PRD, architecture notes, ADRs, issue slices
documentation/           Shipping/audit handoff docs for reviewers and coding agents
user_data/               Ignored local runtime config, secrets, sample agents, and app data
```

All `user_data/` contents are ignored by git. The runtime creates default local templates when missing, and users can edit those files for their own providers, agents, skills, and workflows.

## User Data Layout

```text
user_data/
  config.yaml
  providers/
    models.json
    auth.json              # local secret material
  agents/
    <agent-id>/
      agent.yaml
      system.md
      skills/<skill-id>/SKILL.md
      prompts/
  stories/                 # runtime story/save folders
  lorebooks/               # runtime lorebook files
  novel-agent.db           # SQLite database
```

Skills follow the standard `SKILL.md` entrypoint format:

```markdown
---
name: rp-prose-writing
description: Write the final Chinese role-play prose response from a plan.
---

Skill instructions go here.
```

## Development Workflow

1. Read `AGENTS.md` first if you are a coding agent.
2. Read `docs/technical-architecture.md` and `documentation/architecture.md` before larger changes.
3. Make focused changes with tests near the touched service or e2e flow.
4. Run `npm run typecheck && npm test`.
5. Run `npm run build && npm run test:e2e` before handing off UI, persistence, or workflow changes.

Known build note: `next build` currently succeeds but may emit a Turbopack warning about tracing dynamic filesystem access from the repo-local runtime config loader. The warning is tracked as technical debt; e2e and production build pass.

## Documentation Index

- [MVP PRD](docs/mvp-prd.md)
- [Design Notes](docs/novel-agent-design.md)
- [Glossary](docs/glossary.md)
- [Technical Architecture](docs/technical-architecture.md)
- [Pi Runtime Setup](docs/pi-runtime-setup.md)
- [Issue Slices](docs/issues/mvp-issue-slices.md)
- [ADRs](docs/adr)
- [Shipping Architecture Map](documentation/architecture.md)
- [Automation Map](documentation/automation.md)
- [Test Coverage Map](documentation/tests.md)

## Git Hygiene

Do not commit local databases, provider auth files, imported private character cards, generated `.next/`, or test reports. `.gitignore` covers the standard paths, but check `git status --short --ignored` if a generated file looks suspicious.
