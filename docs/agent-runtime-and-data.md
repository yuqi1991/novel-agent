# Agent Runtime 与数据架构

本文描述 repo-local Runtime 配置、Pi adapter、文件定义 Agent、Skill 和多 Agent 调度。

## 分层

Novel Agent 的 Agent 相关架构分三层：

1. **Pi Runtime 层**：提供模型调用、多轮对话、工具调用、Skill 注入和一级 Subagent。
2. **多 Agent 调度层**：按用户配置的线性顺序运行 Agent，传递上游输出，记录 trace。
3. **RP 业务层**：管理故事、上下文、聊天记录、变体、存档、Wiki 和导入资料。

RP 业务层不能直接依赖 Pi 的内部结构；必须通过 `AgentRuntime` adapter。

## user_data 约定

所有用户配置、密钥和可变运行数据都集中在仓库本地 `user_data/`，并由 `.gitignore` 排除。

```text
user_data/
  config.yaml
  novel-agent.db
  providers/
    auth.json
    models.json
  agents/
    <agent-id>/
      agent.yaml
      system.md
      skills/<skill-id>/SKILL.md
      prompts/
  stories/<story-id>/saves/<session-id>/wiki/
  lorebooks/
```

应用不依赖 `~/.pi/agent/models.json`。如果用户要配置 Provider，应修改 `user_data/providers/*` 或设置环境变量。

## config.yaml

`user_data/config.yaml` 定义默认 workflow 和全局 Runtime 配置。MVP 先支持线性编排：

```yaml
workflows:
  default_play:
    type: linear
    agents:
      - plot-designer
      - literary-writer
```

代码不能写死这些 Agent 名称。缺省示例只用于首次启动时生成可运行模板。

## Agent 定义

每个 Agent 由 `user_data/agents/<agent-id>/` 管理：

```text
agent.yaml
system.md
skills/<skill-id>/SKILL.md
prompts/
```

`agent.yaml` 可包含：

- 显示名称。
- 默认模型。
- timeout。
- 允许使用的工具。
- Skill 列表。
- Subagent 策略。

高级配置不强制做 Web UI；用户可以直接编辑本地文件。

## Skill 格式

Skill 必须遵循标准格式，以 `SKILL.md` 为 prompt 入口，并带 frontmatter：

```markdown
---
name: progress-wiki-curation
description: Maintain cumulative session memory wiki from conversation history.
---

Skill instructions go here.
```

Progress Wiki 的读写行为属于 skill 能力，不作为通用 tool 暴露。Agent 需要提出故事资料变更时，使用受控的 `write_story_material` 能力或 proposal 流程。

## Provider 密钥

密钥可以放在：

- `user_data/providers/auth.json`
- Provider 环境变量，例如 `DEEPSEEK_API_KEY`

密钥不能写入 SQLite、trace、文档或 git。

DeepSeek 示例：

```json
{
  "deepseek": { "type": "api_key", "key": "sk-..." }
}
```

## Subagent 规则

MVP 只支持最大深度 1 的 Subagent。

- 主 Agent 可以调用 Subagent。
- Subagent 只能返回结果文本或结构化结果给主 Agent。
- Subagent 不能直接修改聊天记录、故事资料、Wiki 或任何应用状态。
- 主 Agent 按原任务处理 Subagent 输出，并由应用服务决定是否持久化。

## Trace

每次 workflow attempt 都写入 trace：

- workflow 名称。
- Agent 顺序。
- 每步输入摘要。
- 每步输出。
- Runtime 错误。
- 耗时和状态。

Trace 用于调试，不是玩家可见剧情事实来源。Trace 中不得包含 Provider 密钥。
