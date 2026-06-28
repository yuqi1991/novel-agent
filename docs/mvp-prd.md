# Novel Agent MVP PRD

## 问题

SillyTavern 等工具已经能导入角色卡和世界书，但整体仍偏聊天工具。它们不提供可配置的多 Agent 写作团队、可审计的 Agent trace、稳定的长期记忆、清晰的 reroll/fork/session 管理，也不适合把故事、存档和编排配置分开管理。

Novel Agent 要解决的是：让单个本地用户可以导入或创作 RP 故事，用多个隔离存档游玩，并用可配置多 Agent workflow 生成每轮剧情，同时保留原始聊天记录和可修正的长期记忆。

## 方案

构建一个本地单用户 Web UI，使用 SQLite 存储结构化状态。MVP 支持：

- 故事库：创建、导入、打开多个 Story。
- SillyTavern 导入：角色卡和世界书转为内部 Character Profile / World Entry，同时保留原始 Imported Asset。
- Play Session：每个 Story 下有多个隔离存档。
- 聊天游玩：用户扮演一个可选 Player Character，系统输出一段统一 Narrative Response。
- Reply Variants：最新系统回复可 reroll，所有 variants 保存，可切换。
- Session Fork：从旧楼层或旧 variant 分叉新存档，不改写原存档历史。
- Progress Wiki：每个 session 独立维护长期记忆文档和累计快照。
- 多 Agent 编排：MVP 先支持线性 workflow，每个 Agent 可配置角色、指令、skill、模型、timeout 和工具权限。
- Workflow Trace：每次生成记录 Agent 输入、输出、耗时和失败信息，供调试。

## 核心用户故事

1. 用户可以创建 Story，用于定义可复用故事世界。
2. 用户可以导入 SillyTavern 角色卡和世界书，并转成内部可编辑资料。
3. 用户可以在一个 Story 下创建和切换多个 Play Session。
4. 每个 Play Session 的聊天记录、Progress Wiki 和快照互相隔离。
5. 用户可以 reroll 最新系统回复，并保存所有 Reply Variants。
6. 只有最新系统回复可以原地修改；旧楼层变化必须通过 Session Fork。
7. 用户可以从历史 Conversation Position fork 新 session，只继承 fork 点之前的记录。
8. Progress Wiki 以累计快照保存，例如 `0-10`、`0-20`、`0-30`。
9. 用户可以编辑 Story Material，包括角色、人设、世界书条目和玩家角色设置。
10. 编排配置独立于 Story，可在不同故事复用。
11. 每一轮游玩运行一次完整多 Agent workflow，切换编排只影响未来输出。
12. Agent 可以使用 Skill，Skill 使用标准 `SKILL.md` 入口。
13. Agent 可以调用一级只读 Subagent；Subagent 只返回结果给主 Agent。
14. Agent 失败或 timeout 时，本轮 workflow 失败，不写入剧情聊天记录。
15. 用户可以查看 Workflow Trace 来调试 prompt、skill、tool、model 和 timeout。

## 实现决策

- MVP 是本地单用户应用，无账号、认证、云同步和多人联机。
- 主要界面是 Web UI：故事库、游玩工作区、故事资料、存档管理、Progress Wiki、Agent 管理、Agent 编排和运行记录。
- SQLite 是权威结构化存储；JSONL 只用于导入、导出、备份或交换。
- Story Material 归 Story 共享；Progress Wiki 归 Play Session 私有。
- Conversation Log 是原始事实来源；Progress Wiki 是派生、可编辑长期记忆。
- Reply Variants 全部持久化；运行上下文沿 Selected Path 组装。
- Wiki Snapshot 是完整累计快照，不是增量片段。
- 自动 Wiki 整理允许由授权 memory agent 执行，但必须落在稳定 Memory Boundary 之后。
- Story Material 的 Agent 写入需要 proposal/review 边界，不能静默改共享设定。
- MVP workflow 是用户配置的线性顺序。
- 系统层不强制 Agent 输出结构化字段；需要 JSON 样式时由用户在 agent/skill prompt 中定义。
- Runtime 分为三层：Agent Runtime、多 Agent Scheduler、Role-Play Domain。
- Pi 只作为 Runtime adapter，不定义 RP 领域模型。
- 外部工具通过用户提供的 MCP 配置启用；核心游玩不依赖网络工具。

## 测试重点

- Story 创建、列表、打开和本地目录创建。
- SillyTavern 角色卡/世界书导入、原始 asset 保留和内部资料转换。
- Session 隔离、聊天追加、失败回滚。
- Reply Variant 保存、选择和 Mutable Tail 规则。
- Fork 复制正确聊天前缀和正确 Wiki Snapshot。
- Progress Wiki 文档、累计快照和 session 隔离。
- Context Pack 包含近期聊天、Story Material、World Entries、Player Character 和 Wiki。
- 线性 Agent workflow 的顺序执行、timeout、trace 和失败行为。
- Web UI 的核心导航和故事库/聊天/资料/存档面板。

## 非目标

- 多人联机或共享 session。
- 用户账号、认证、授权或云同步。
- Hosted multi-tenant 部署。
- SillyTavern 导出。
- SillyTavern 全量聊天、群聊、插件、regex script 或 prompt preset 迁移。
- 公开角色/世界市场。
- Village Mode：一个 Agent 独立扮演一个 NPC。
- 任意图/DAG workflow。
- 系统强制结构化 Agent 输出 schema。
- 未经用户 review 的自动 Story Material mutation。
- 必须联网的默认游玩体验。
