# Pi Runtime 配置

Novel Agent 在非测试环境默认使用 `@earendil-works/pi-coding-agent`。Runtime 配置集中在仓库本地 `user_data/`，用户不需要、也不应该为本应用修改 `~/.pi/agent/models.json`。

## user_data 布局

首次加载 Runtime 时，应用会创建以下 git 忽略目录：

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

`user_data/` 全部视为本地用户配置和可变游玩数据，不能提交。

## Provider 密钥

Provider credentials 可以放在 `user_data/providers/auth.json`，也可以使用 Pi 支持的环境变量。应用不会把 API key 存入 SQLite 或 Web UI。

DeepSeek 示例：

```json
{
  "deepseek": { "type": "api_key", "key": "sk-..." }
}
```

等价环境变量：

```bash
DEEPSEEK_API_KEY=sk-...
```

当前默认模型配置是 `deepseek/deepseek-v4-flash`。`user_data/providers/models.json` 会包含 DeepSeek 的 OpenAI-compatible provider entry，所以不依赖全局 Pi 配置。

## Agent 和 Skill 文件

Agent 定义在 `user_data/agents/<agent-id>/agent.yaml`。默认 workflow 是两步线性流程：

```yaml
workflows:
  default_play:
    type: linear
    agents:
      - plot-designer
      - literary-writer
```

Skill 必须使用标准目录格式：每个 skill 是一个文件夹，入口为 `SKILL.md`，frontmatter 包含 `name` 和 `description`。

```markdown
---
name: rp-prose-writing
description: Write the final Chinese role-play prose response from a plan.
---

Turn upstream planning notes into immersive Chinese role-play prose for the player.
```

高级 prompt、skill、timeout、tool 和模型配置可以通过编辑 `user_data/agents/*` 完成，Web UI 不需要覆盖所有高级字段。

## Runtime Override

常用环境变量：

- `NOVEL_AGENT_RUNTIME=stub|pi`
- `NOVEL_AGENT_USER_DATA_DIR=/path/to/user_data`
- `NOVEL_AGENT_PI_AUTH_PATH=/path/to/auth.json`
- `NOVEL_AGENT_PI_MODELS_PATH=/path/to/models.json`
- `NOVEL_AGENT_PI_NO_TOOLS=true|false`

自动化测试使用确定性 Stub Runtime。`.env.example` 默认使用 `stub`，方便没有 Provider 密钥时启动本地 Web UI。
