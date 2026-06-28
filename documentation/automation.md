# Automation

Novel Agent embeds an agent workflow in the play loop. There are no scheduled jobs, webhooks, or autonomous background workers in the current implementation.

## Play Generation Workflow

| Field | Current behavior |
| --- | --- |
| Trigger | User submits a player message or rerolls the latest system response |
| Owner | `src/services/orchestration-service.ts` |
| Runs automatically? | Yes, synchronously inside the user action |
| Runtime | Deterministic stub when `NOVEL_AGENT_RUNTIME=stub`; Pi adapter when `NOVEL_AGENT_RUNTIME=pi` |
| Workflow source | `user_data/config.yaml` |
| Agent source | `user_data/agents/<agent-id>/agent.yaml`, `system.md`, `skills/*/SKILL.md`, `prompts/` |
| Current sample workflow | `plot-designer` then `literary-writer` |

## Inputs Agents May Read

Agents receive an assembled context pack containing:

- Player latest message
- Recent selected-path conversation
- Story fixed context
- Character profiles
- Selected world entries
- Player character material when configured
- Session Progress Wiki documents
- Upstream agent outputs
- Agent instructions and system prompt

## Tool Surface

Current MVP runtime config defaults to `noTools: true`. Built-in persistence writes are not exposed directly as agent tools. Agents return text to orchestration; app services decide what to store.

Planned external tools such as MCP/web search are user-configured future work and must be scoped through explicit agent skill/tool configuration.

## Steering Versus Guardrails

Prompt steering:

- `user_data/agents/<agent-id>/system.md`
- `user_data/agents/<agent-id>/agent.yaml`
- `user_data/agents/<agent-id>/skills/<skill-id>/SKILL.md`
- Prompt assembly in `orchestration-service.ts`

Hard guardrails:

- Service-layer validation with Zod.
- Session/story ownership checks before writes.
- Only latest system response can be rerolled or have selected variant changed.
- Workflow failure prevents reply variant append.
- Subagent service model is read-only.
- Provider tools disabled by default with `noTools: true`.

## Output Contract

Each agent returns plain text. The scheduler stores every step in `workflow_trace_steps`. The final non-empty output from the last workflow step becomes the narrative response text for the reply variant.

Failure contract:

- A failed workflow writes a failed workflow trace.
- Succeeded prior steps may be recorded.
- No reply variant is appended to the conversation log.
- For a new player message, the provisional player turn is removed.

## Audit And Kill Switches

Audit surfaces:

- `workflow_traces`
- `workflow_trace_steps`
- Trace Viewer panel in the story workspace

Kill switches:

- Set `NOVEL_AGENT_RUNTIME=stub` to avoid external provider calls.
- Keep `pi.noTools: true` or `NOVEL_AGENT_PI_NO_TOOLS=true` to disable Pi tools.
- Remove or edit agents from `user_data/config.yaml` to change the workflow.

## Current Gaps

- No rate limiting beyond local single-user assumption.
- No provider cost tracking.
- No tool-call audit because tools are disabled by default and not integrated into MVP play.
- No asynchronous memory-curation worker yet.
