# Pi Runtime Setup

Novel Agent uses `@earendil-works/pi-coding-agent` as the default runtime outside tests.

## Configure Auth

Use Pi's own auth flow or auth file. The app does not store provider API keys in SQLite or the Web UI.

- Default auth path: `~/.pi/agent/auth.json`
- Override auth path: `NOVEL_AGENT_PI_AUTH_PATH=/path/to/auth.json`
- Override models path: `NOVEL_AGENT_PI_MODELS_PATH=/path/to/models.json`

For the current local MVP, the default orchestration model is `deepseek/deepseek-v4-flash`. Configure the key in Pi auth as provider `deepseek`, or set `DEEPSEEK_API_KEY` before starting `npm run dev`.

If your Pi install does not already know `deepseek-v4-flash`, add it to `~/.pi/agent/models.json` with DeepSeek's OpenAI-compatible endpoint:

```json
{
  "providers": {
    "deepseek": {
      "baseUrl": "https://api.deepseek.com/v1",
      "api": "openai-completions",
      "authHeader": true,
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "deepseek-v4-flash",
          "name": "DeepSeek V4 Flash",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 8192
        }
      ]
    }
  }
}
```

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
