# Tests

## Existing Coverage

| Use case | Rule | Expected behavior | Evidence | Status |
| --- | --- | --- | --- | --- |
| DB migration | Schema applies cleanly | Migrations run against SQLite | `src/db/migration.test.ts` | Existing unit/integration |
| Story creation | Story has default settings | Story and settings persist | `src/services/story-service.test.ts` | Existing unit/integration |
| Story directory | Story creates user_data folder | `user_data/stories/<story-id>/saves` exists | `src/services/story-service.test.ts` | Existing unit/integration |
| Session isolation | Sessions under same story do not share logs | One session transcript remains empty | `src/services/session-service.test.ts` | Existing unit/integration |
| Session directory | Session creates wiki folder | `saves/<session-id>/wiki` exists | `src/services/session-service.test.ts` | Existing unit/integration |
| First player turn | Player message and response persist | Conversation positions, reply variant, trace steps exist | `src/services/session-service.test.ts` | Existing unit/integration |
| Reroll | Only latest system response can mutate | New variant persists and is selected | `src/services/session-service.test.ts`, `tests/e2e/reply-variants.spec.ts` | Existing unit/e2e |
| Fork | Fork copies selected prefix only | Later source positions are excluded | `src/services/session-service.test.ts`, `tests/e2e/session-fork.spec.ts` | Existing unit/e2e |
| Wiki snapshots | Fork copies eligible memory snapshot | Snapshot boundary behavior is preserved | `src/services/session-service.test.ts`, `src/services/progress-wiki-service.test.ts` | Existing unit/integration |
| SillyTavern import | Character/world JSON converts to internal model | Imported character/world entries persist | `src/services/story-creation-service.test.ts`, `src/services/sillytavern-import-service.test.ts`, `tests/e2e/sillytavern-import.spec.ts` | Existing unit/e2e |
| Context assembly | Context includes recent conversation/material/wiki | Context pack shape matches expectations | `src/services/context-assembly-service.test.ts` | Existing unit/integration |
| Agent capabilities | Subagents are read-only; story material proposals are gated | Invalid mutation surfaces are rejected | `src/services/agent-capability-service.test.ts` | Existing unit |
| Runtime config | Repo-local user_data config loads sample agents and SKILL.md | Workflow agents resolve from config | `src/services/agent-runtime/runtime-config.test.ts` | Existing unit |
| Orchestration | Multi-agent workflow passes upstream output downstream | Two agent steps run in order | `src/services/orchestration-service.test.ts` | Existing unit/integration |
| Trace viewer | Trace details are visible after play turn | Runtime payload can be inspected | `src/services/trace-service.test.ts`, `tests/e2e/trace-viewer.spec.ts` | Existing unit/e2e |
| UI shell | Story library and panels render | Main app surfaces are reachable | `tests/e2e/story-library.spec.ts`, other e2e specs | Existing e2e |

CI in `.github/workflows/ci.yml` runs typecheck, unit tests, build, and e2e tests.

## Proposed Tests

| Use case | Rule | Expected behavior | Type |
| --- | --- | --- | --- |
| Real Pi smoke test | Pi runtime can call configured provider | A guarded live test succeeds with local credentials | Guarded live |
| Provider auth absent | Real runtime fails with actionable error | Missing auth/model produces clear UI or service error | Automated integration |
| Runtime config invalid | Bad YAML or missing agent fails clearly | No partial conversation write | Automated integration |
| File-backed wiki migration | Wiki file writer mirrors/owns document content | Fork and snapshot behavior remains correct | Automated integration |
| MCP/web search tools | User-configured external tools are scoped to selected agents | Disallowed agent cannot call tool | Automated integration |
| Trace privacy review | Trace includes expected context and no provider secret | Auth material never appears in trace payload | Automated unit/manual review |

## Gaps

| Gap | Exposure |
| --- | --- |
| No live provider CI | Pi adapter behavior is mostly verified structurally and through stub workflow, not against a real provider in CI. |
| No cost/rate-limit checks | A misconfigured real provider workflow can spend tokens until provider-side limits apply. |
| No file-backed wiki tests | Directory layout exists, but wiki document content is still SQLite-backed. |
| No MCP/tool-call tests | External tool support is planned but not wired into MVP play. |
| No multi-user auth tests | By design there is no account system; adding accounts will require a new permission model and tests. |
