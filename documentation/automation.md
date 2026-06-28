# 自动化地图

Novel Agent 在游玩循环中嵌入 Agent workflow。当前实现没有定时任务、webhook 或自主后台 worker。

## 游玩生成 Workflow

| 字段 | 当前行为 |
| --- | --- |
| 触发 | 用户提交玩家消息，或重掷最新系统回复 |
| Owner | `src/services/orchestration-service.ts` |
| 是否自动运行 | 是，在用户 action 内同步运行 |
| Runtime | `NOVEL_AGENT_RUNTIME=stub` 时使用确定性 Stub；`NOVEL_AGENT_RUNTIME=pi` 时使用 Pi adapter |
| Workflow 来源 | `user_data/config.yaml` |
| Agent 来源 | `user_data/agents/<agent-id>/agent.yaml`、`system.md`、`skills/*/SKILL.md`、`prompts/` |
| 当前示例 workflow | `plot-designer` 后接 `literary-writer` |

## Agent 可读取输入

Agent 接收组装后的 Context Pack，包含：

- 玩家最新消息。
- 最近的 selected-path 聊天记录。
- 故事固定背景。
- 角色资料。
- 命中的世界书条目。
- 已配置的玩家角色资料。
- 当前存档的 Progress Wiki 文档。
- 上游 Agent 输出。
- Agent instructions 和 system prompt。

## 工具边界

当前 MVP Runtime 配置默认 `noTools: true`。内置持久化写入不会直接作为 Agent tool 暴露。Agent 返回文本给编排服务，由应用服务决定写入内容。

MCP/web search 等外部工具是后续能力，必须通过明确的 Agent skill/tool 配置授权。

## Prompt Steering 与硬 Guardrail

Prompt steering 来源：

- `user_data/agents/<agent-id>/system.md`
- `user_data/agents/<agent-id>/agent.yaml`
- `user_data/agents/<agent-id>/skills/<skill-id>/SKILL.md`
- `orchestration-service.ts` 中的 prompt assembly

硬 guardrail：

- Zod 服务层校验。
- 写入前检查 session/story 归属。
- 只有最新系统回复可以 reroll 或切换 selected variant。
- Workflow 失败不会追加 reply variant。
- Subagent 服务模型只读。
- Provider tools 默认通过 `noTools: true` 禁用。

## 输出契约

每个 Agent 返回纯文本。调度器把每一步保存到 `workflow_trace_steps`。最后一步的非空输出成为 reply variant 的 narrative response。

失败契约：

- 失败 workflow 写入 failed trace。
- 已成功的前置步骤可以被记录。
- 不向聊天记录追加 reply variant。
- 如果是新玩家消息触发，本轮临时玩家消息会移除。

## 审计和 Kill Switch

审计面：

- `workflow_traces`
- `workflow_trace_steps`
- 故事工作区中的运行记录面板

Kill switch：

- 设置 `NOVEL_AGENT_RUNTIME=stub` 避免外部 Provider 调用。
- 保持 `pi.noTools: true` 或 `NOVEL_AGENT_PI_NO_TOOLS=true` 禁用 Pi tools。
- 修改 `user_data/config.yaml` 中的 workflow 改变或清空 Agent 顺序。

## 当前缺口

- 没有 Provider 成本追踪。
- 没有额外 rate limit。
- 工具调用尚未接入核心游玩，所以没有 tool-call audit。
- 异步记忆整理 worker 尚未实现。
