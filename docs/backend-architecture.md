# 后端架构

本文描述 Next.js Server Actions、服务层、SQLite 数据模型和关键状态流。

## 后端边界

MVP 没有独立 API Server。浏览器表单提交到 `src/app/*-actions.ts`，Server Action 调用 `src/services/` 中的应用服务。

后端边界按以下顺序组织：

1. Server Action 解析 `FormData`。
2. 服务层使用 Zod 校验输入。
3. 服务层执行业务规则和归属关系检查。
4. Drizzle 写入 SQLite。
5. 必要时 revalidate 或 redirect。

## 主要服务

| 服务 | 职责 |
| --- | --- |
| `story-service.ts` | 创建、更新、列出故事，并创建 repo-local 故事目录。 |
| `story-material-service.ts` | 角色、人设、世界书条目、玩家角色配置。 |
| `story-creation-service.ts` | 从草稿创建故事，并保存导入资产、角色和世界书。 |
| `sillytavern-import-service.ts` | 解析 SillyTavern 角色卡和世界书。 |
| `session-service.ts` | Play Session、聊天记录、回复变体、重掷、分叉。 |
| `progress-wiki-service.ts` | 存档绑定的 Wiki 文档和累计快照。 |
| `context-assembly-service.ts` | 根据故事资料、世界书、最近聊天和 Wiki 组装 Context Pack。 |
| `orchestration-service.ts` | 加载工作流、运行 Agent、保存 Workflow Trace。 |
| `trace-service.ts` | 查询运行记录供 UI 展示。 |

## 数据事实来源

- SQLite 是结构化事实来源。
- 原始聊天记录是剧情事实来源。
- Progress Wiki 是派生记忆，必须允许重建、编辑和按快照恢复。
- 导入的 SillyTavern 原始 payload 要保存为 Imported Asset，内部模型只保存转换后的可编辑资料。

## 会话和变体

一个 Story 下可以有多个 Play Session。每个 Session 的聊天记录完全隔离。

每次玩家发送消息：

1. 追加玩家消息。
2. 运行多 Agent workflow。
3. 保存系统回复楼。
4. 保存一个 Reply Variant，并选中它。

如果 workflow 失败，本轮玩家消息会回滚，不产生半截聊天记录。

只有最后一个系统回复楼是 Mutable Tail，可以继续 reroll 并保存多个 Reply Variants。用户继续输入下一轮后，之前的楼层不可原地修改，只能 fork。

## Fork 和 Wiki Snapshot

Session fork 从指定楼层复制聊天前缀。对于 Progress Wiki，fork 继承不超过 fork 楼层的最新累计快照。

MVP 记忆整理策略：

- 每 N 轮触发一次整理。
- 异步整理只整理 N 轮之前的内容。
- Snapshot 是累计快照，例如 `0-10`、`0-20`、`0-30`。
- 从第 25 楼 fork 时继承 `0-20` 快照和 `0-25` 原始聊天记录。

## SQLite 模型概览

核心表包括：

- `stories`
- `story_settings`
- `imported_assets`
- `character_profiles`
- `world_entries`
- `play_sessions`
- `conversation_positions`
- `player_messages`
- `reply_variants`
- `progress_wiki_documents`
- `wiki_snapshots`
- `agent_profiles`
- `orchestration_configurations`
- `agent_assignments`
- `workflow_traces`
- `workflow_trace_steps`
- `external_tool_configurations`
- `story_material_proposals`

JSON 字段只用于灵活 payload，例如导入原文、触发配置、tags、trace payload、Provider/工具配置。

## 权限模型

当前是本地单用户应用，没有账号和行级权限。服务层仍必须检查：

- session 属于 story。
- fork 位置属于 source session。
- reply variant 属于被 fork 或选择的系统回复楼。
- 角色和世界书条目属于当前 story。
- Wiki document 属于当前 session。

未来如果引入账号系统，需要先重写这些边界为显式用户/租户权限模型。
