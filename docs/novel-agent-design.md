# Novel Agent 产品设计说明

Novel Agent 是一个本地单用户 Web UI，用于创作和游玩由 Agent 驱动的文字 RP 故事。MVP 聚焦一个玩家、多个 Story、隔离 Play Session、SillyTavern 导入、可配置多 Agent 写作团队，以及 session 级长期记忆。

## 产品范围

MVP 是单人 RP 框架。用户管理多个 Story，在每个 Story 下创建多个 Play Session，可选择扮演一个 Player Character，并在每轮收到一段统一 Narrative Response。

MVP 不包含多人联机、账号、云同步、分享、市场、SillyTavern 导出、完整聊天迁移、群聊迁移、插件迁移或 prompt preset 迁移。

## 核心领域模型

Story 是可复用故事容器，拥有共享 Story Material，例如 Character Profiles、World Entries、导入资产和固定世界说明。

Play Session 是 Story 下的隔离游戏存档，拥有自己的 Conversation Log、Selected Path、Reply Variants、Progress Wiki 和 Wiki Snapshots。一个 Story 下的多个 Session 可以彼此矛盾，不污染共享 Story Material。

Player Character 可选。为空时，不向 Context Pack 注入结构化玩家角色资料。系统是否允许补少量玩家过渡对白，不是产品级硬规则，应写入 Agent 指令或 Skill。

MVP 使用 Writing Team Mode：多个 Agent 负责剧情规划、世界推演、文字润色、记忆整理等功能性任务。Village Mode，即一个 Agent 独立扮演一个 NPC，是未来扩展。

## 聊天、Reroll 和 Fork

Conversation Log 是 Play Session 的原始事实来源，保存玩家消息、系统 Narrative Response 和所有 Reply Variants。

Reply Variant 是同一个系统回复楼的一个候选输出。最新系统回复是 Mutable Tail，可以原地切换 variant 或 reroll。用户继续输入下一轮后，当前 Selected Variant 成为 Selected Path 的一部分。

旧 variant 仍保存，但不能在原 session 中改写历史。用户要从旧楼层或旧 variant 继续，必须创建 Session Fork。

Session Fork 继承 source session 到指定 Conversation Position 为止的前缀，并丢弃后续记录。例如 source 到 29 楼，从 25 楼 fork，则新 session 继承 0-25，丢弃 26-29。

## Progress Wiki 和记忆

每个 Play Session 拥有独立 Progress Wiki。它是长期记忆文档库，记录稳定事实、剧情进度、人物变化、世界变化、未解决线索、关系、时间线和物品等 session-specific 状态。

Conversation Log 保持原始事实；Progress Wiki 是从稳定聊天范围中整理出的可编辑记忆视图。

Wiki Snapshot 是 Memory Boundary 上的完整累计 Wiki。MVP 可以每 N 个 Conversation Position 触发整理，但只整理最近可变范围之前的内容。例如聊到 50 楼、步长 10，可以整理 0-40，41-50 仍作为近期原始上下文。

从 25 楼 fork 且已有 0-10、0-20 快照时，新 session 继承 0-20 快照和 0-25 原始聊天记录。

## 上下文组装

Context Pack 是一次 Agent 推理的输入。它可以包含：

- 最近 selected-path 聊天。
- 相关 Progress Wiki 文档。
- Story Material。
- 命中的 World Entries。
- 已配置 Player Character。
- 上游 Agent Output。
- 当前 Agent 指令和 Skill 内容。

World Entry 支持四种 inclusion mode：always、triggered、semantic、disabled。

## 编排

Orchestration Configuration 是独立可复用的 Agent 编排，不绑定 Story。Story 特殊规则应写入 Story Material、World Entries 或 Agent 可读上下文。

MVP 使用 Linear Workflow：Agent Assignments 按用户配置顺序运行，例如 A -> B -> C。Multi-Agent Scheduler 把上游 Agent Output 作为字符串传给下游。系统不强制结构化输出 schema。

每个 Agent Assignment 可定义：

- Agent Role。
- instructions。
- Skill Set。
- model/provider override。
- timeout。
- order。
- allowed tools。

当前实现从 `user_data/config.yaml` 和 `user_data/agents/<agent-id>/agent.yaml` 加载活跃 play workflow。Web UI 的编排配置保留用于管理和未来选择，高级 Runtime 调优先走本地文件。

Agent 失败或 timeout 时，当前 Generation Workflow 失败，不产生 Reply Variant。Workflow Trace 单独保存供 Trace Viewer 调试。

## Agent 架构层

架构分三层：

- Agent Runtime：调用 LLM provider，支持多轮、tool call、skill、subagent。
- Multi-Agent Scheduler：协调 Agent Assignments、线性执行和步骤传递。
- Role-Play Domain：拥有 Stories、Play Sessions、Conversation Logs、Progress Wikis、Story Material、Context Packs 和玩家可见行为。

Pi 是 Runtime adapter，不是 RP 领域模型来源。

## Skill、Tool 和 Subagent

Tool 是 Runtime 暴露的可调用能力，可以来自内置能力、MCP、web search 或其他 API。

Skill 是 Agent 可复用任务方法，不只是工具列表。文件定义 Skill 使用 `skills/<skill-id>/SKILL.md`，frontmatter 包含 `name` 和 `description`。

Subagent 是短生命周期辅助 Agent，MVP 最大深度 1。Subagent 获取只读上下文，只返回 findings、drafts、candidates 或 recommendations，不能直接改 Conversation Log、Progress Wiki 或 Story Material。

Progress Wiki 读写和快照应由 Progress Wiki Skill 约束。Story Material 变更应走 proposal/review 边界。

## SillyTavern 兼容

SillyTavern 是导入格式，不是内部模型。

MVP 支持：

- SillyTavern Character Import：常见角色卡 JSON 或 PNG metadata。
- SillyTavern World Import：world/lorebook JSON。

导入原文保存为 Imported Asset，同时转换为 Character Profiles 和 World Entries。

## Web UI 工作区

- Story Library：列出、创建、导入和打开 Story。
- Play Workspace：聊天游玩、session 切换、reroll、fork。
- Story Material Editor：编辑角色、世界书、固定资料和导入映射。
- Progress Wiki Editor：查看和修正当前 session 记忆和快照。
- Orchestration Builder：配置 Agent 顺序、指令、Skill、timeout、模型和工具。
- Trace Viewer：查看 Workflow Trace。

## 存储决策

SQLite 是主存储，保存 Story、Session、Conversation Log、Reply Variant、Selected Path、Wiki Snapshot、Story Material、Imported Asset、Orchestration Configuration 和 Workflow Trace。

所有本地 Runtime 配置和可变数据都位于 git 忽略的 `user_data/`。默认数据库是 `user_data/novel-agent.db`；Provider 配置在 `user_data/providers/`；文件定义 Agent 和 Skill 在 `user_data/agents/`。
