# Pi Runtime Setup

Novel Agent uses `@earendil-works/pi-coding-agent` as the default runtime outside tests. Runtime configuration is repo-local under `user_data/`; users should not edit `~/.pi/agent/models.json` for this app.

## User Data Layout

The app creates this layout on first runtime load:

```text
user_data/
  config.yaml
  novel-agent.db
  providers/
    auth.json
    models.json
  agents/
    plot-designer/
      agent.yaml
      system.md
      skills/plot-planning/SKILL.md
      prompts/
    literary-writer/
      agent.yaml
      system.md
      skills/rp-prose-writing/SKILL.md
      prompts/
  stories/
  lorebooks/
```

Tracked examples include `config.yaml`, `providers/models.json`, and the two sample agents. Runtime secrets and mutable play data are ignored by git.

## Provider Auth

Put provider credentials in `user_data/providers/auth.json`, or use provider environment variables supported by Pi. The app does not store provider API keys in SQLite or the Web UI.

For the current local MVP, `user_data/config.yaml` defaults to `deepseek/deepseek-v4-flash`. `user_data/providers/models.json` already contains the DeepSeek OpenAI-compatible provider entry, so no global Pi config is required.

## Agent And Skill Files

Agents are file-defined under `user_data/agents/<agent-id>/agent.yaml`. The default workflow is a two-agent linear workflow:

```yaml
workflows:
  default_play:
    type: linear
    agents:
      - plot-designer
      - literary-writer
```

Skill directories must use the standard skill format. Each skill is a folder with `SKILL.md` as the prompt entrypoint and frontmatter containing `name` and `description`:

```markdown
---
name: rp-prose-writing
description: Write the final Chinese role-play prose response from a plan.
---

Turn upstream planning notes into immersive Chinese role-play prose for the player.
```

Advanced prompt and skill tuning should be done by editing files in `user_data/agents/*`; the Web UI does not need to expose every advanced agent field.

## Runtime Overrides

Useful environment overrides:

- `NOVEL_AGENT_RUNTIME=stub|pi`
- `NOVEL_AGENT_USER_DATA_DIR=/path/to/user_data`
- `NOVEL_AGENT_PI_AUTH_PATH=/path/to/auth.json`
- `NOVEL_AGENT_PI_MODELS_PATH=/path/to/models.json`
- `NOVEL_AGENT_PI_NO_TOOLS=true|false`

Automated tests run with the deterministic stub runtime. Manual `npm run dev` uses Pi by default.
