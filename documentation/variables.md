# Variables And Secrets

## Runtime Variables

| Name | Used by | Scope | Source | Rotation | Risk |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | `src/db/client.ts`, Drizzle config | Server | Env, defaults to `file:./user_data/novel-agent.db` | Replace DB file or URL | Controls persistent app database location |
| `NOVEL_AGENT_RUNTIME` | Agent runtime selector | Server | Env, defaults to `pi` outside tests and `stub` in tests | Change env and restart | `pi` can send context to external provider |
| `NOVEL_AGENT_USER_DATA_DIR` | Runtime config and data path | Server | Env, defaults to `user_data` | Change env and migrate/copy data | Points to config, auth, agents, stories |
| `NOVEL_AGENT_PI_CWD` | Pi runtime | Server | Env or config | Restart | Changes Pi project working directory |
| `NOVEL_AGENT_PI_AGENT_DIR` | Pi runtime | Server | Env or config | Restart | Changes Pi agent resource root |
| `NOVEL_AGENT_PI_AUTH_PATH` | Pi auth storage | Server | Env or config | Replace auth file | Contains provider auth if file-backed |
| `NOVEL_AGENT_PI_MODELS_PATH` | Pi model registry | Server | Env or config | Replace models file | Can redirect provider endpoints |
| `NOVEL_AGENT_PI_NO_TOOLS` | Pi runtime tool availability | Server | Env or config | Restart | If false, expands runtime capability surface |
| `PORT` | Next dev/start server | Server | Env | Restart | Local serving port only |

## Local Config Files

| File | Tracked | Purpose | Risk |
| --- | --- | --- | --- |
| `user_data/config.yaml` | Yes | Default runtime/provider/workflow config | Can route play to different agents/providers |
| `user_data/providers/models.json` | Yes | Provider/model registry seed | Can define external provider endpoints |
| `user_data/providers/auth.json` | No | Provider credentials | Secret; never commit |
| `user_data/agents/*` | Yes for samples | Agent system prompts, skill directories, workflow resources | Prompt changes affect generation behavior |
| `user_data/*.db` | No | Local SQLite database | Contains imported content and chats |
| `user_data/stories/` | No | Runtime story/save/wiki directories | Contains user play data as file-backed features grow |

## Client Exposure

No provider secrets are intentionally bundled client-side. Provider auth is read only on the server by the Pi runtime adapter. Browser-visible data includes story material, chat messages, wiki docs, and trace details rendered by the local Web UI.

## Pre-Go-Live Checklist

- Keep `NOVEL_AGENT_RUNTIME=stub` for demos that must avoid external provider calls.
- Use `NOVEL_AGENT_RUNTIME=pi` only after configuring provider credentials intentionally.
- Confirm `user_data/providers/auth.json` is ignored and not staged.
- Confirm imported private character cards are not committed.
- Review trace visibility before sharing a local database; traces include prompts and context packs.
