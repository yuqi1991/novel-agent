# Contributing

Novel Agent is currently a local-first MVP. Contributions should keep the codebase easy for human reviewers and coding agents to audit.

## Setup

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

## Before Opening A PR

Run:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

If a check cannot be run, document why and what local evidence you used instead.

## Change Guidelines

- Keep changes scoped to the feature or bug.
- Add or update tests for persistence, import, orchestration, agent runtime, or UI workflow changes.
- Update `README.md`, `AGENTS.md`, `docs/`, or `documentation/` when behavior, setup, data layout, or safety boundaries change.
- Add Drizzle migrations with `npm run db:generate` after schema changes.
- Do not commit local secrets, databases, generated build outputs, or private imported character cards.

## Documentation Guidelines

- Product intent and design decisions live in `docs/`.
- Reviewer/auditor handoff docs live in `documentation/`.
- Coding-agent operating context lives in `AGENTS.md`.

Keep these documents factual. If a capability is planned but not implemented, say so explicitly.
