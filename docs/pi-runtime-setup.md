# Pi Runtime Setup

Novel Agent uses `@earendil-works/pi-coding-agent` as the default runtime outside tests.

## Configure Auth

Use Pi's own auth flow or auth file. The app does not store provider API keys in SQLite or the Web UI.

- Default auth path: `~/.pi/agent/auth.json`
- Override auth path: `NOVEL_AGENT_PI_AUTH_PATH=/path/to/auth.json`
- Override models path: `NOVEL_AGENT_PI_MODELS_PATH=/path/to/models.json`

## Optional Runtime Config

Copy `config/agent-runtime.example.json` to `config/agent-runtime.json` and adjust local skill or prompt paths.

```json
{
  "runtime": "pi",
  "cwd": ".",
  "agentDir": "~/.pi/agent",
  "skillPaths": ["./config/pi-skills"],
  "promptPaths": ["./config/pi-prompts"],
  "noTools": true
}
```

`noTools` defaults to `true` for the role-play MVP. Advanced skills and prompts can be edited as local files.

## Test Stub

Automated tests run with `NOVEL_AGENT_RUNTIME=stub`. Manual `npm run dev` uses Pi by default.
