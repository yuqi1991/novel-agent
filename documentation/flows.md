# 流程地图

本文列出会跨越信任边界、改变持久状态或调用自动化/Provider 的流程。

## 手动创建故事

| 字段 | 值 |
| --- | --- |
| Actor | 本地用户 |
| 前置条件 | 应用已启动，数据库已迁移 |
| 成功结果 | Story 和默认设置写入 SQLite；创建故事数据目录 |

步骤：

1. 浏览器把创建故事表单提交到 `createStoryAction`。
2. Server Action 调用 `createStory`。
3. 服务用 Zod 校验 title/description。
4. 服务插入 `stories` 和 `story_settings`。
5. 服务创建 `user_data/stories/<story-id>/saves/`。

鉴权：无账号级鉴权；服务层负责输入合法性。

副作用：SQLite 写入、本地目录创建。

## 导入 SillyTavern 角色卡或世界书

| 字段 | 值 |
| --- | --- |
| Actor | 本地用户 |
| 前置条件 | 用户提供 JSON payload |
| 成功结果 | Imported Asset、Character Profiles、World Entries 写入 SQLite |

步骤：

1. 浏览器提交粘贴的 JSON。
2. Server 通过 SillyTavern import service 解析 payload。
3. 用户在 UI 中检查预填好的故事草稿。
4. 浏览器提交草稿到 `createStoryFromDraftAction`。
5. 服务校验草稿数组。
6. 服务写入 `imported_assets`、`character_profiles` 和 `world_entries`。
7. 服务创建 `user_data/stories/` 下的故事目录。

拒绝情况：无效 JSON、不支持的格式、空故事标题、无效草稿数组。

副作用：SQLite 写入；原始导入 payload 保存到 SQLite。

## 发送玩家消息

| 字段 | 值 |
| --- | --- |
| Actor | 本地用户 |
| 前置条件 | Story 存在；active session 存在或可创建 |
| 成功结果 | 玩家消息、系统回复楼、reply variant 和 workflow trace 写入 SQLite |

步骤：

1. 浏览器提交聊天消息到 `submitPlayerMessageAction`。
2. `submitPlayerMessage` 校验 story/session/message。
3. 服务确认 session 属于 story。
4. 服务追加玩家 `conversation_positions` 和 `player_messages`。
5. `runGenerationWorkflow` 组装 context。
6. 编排服务读取 `user_data/config.yaml` 和文件定义 Agent。
7. 每个 Agent 通过 Stub 或 Pi Runtime 顺序执行。
8. 每个 Agent step 写入 `workflow_trace_steps`。
9. 最终 Agent 输出保存为新的 `reply_variants` 并选中。

失败行为：如果生成失败，玩家本轮消息会移除，不追加 reply variant。

信任边界：浏览器到 Server Action；Server 到 SQLite；`NOVEL_AGENT_RUNTIME=pi` 时 Server 到 Provider。

## 重掷最新回复

| 字段 | 值 |
| --- | --- |
| Actor | 本地用户 |
| 前置条件 | 最新聊天楼层是系统回复 |
| 成功结果 | 新 reply variant 写入并被选中 |

步骤：

1. 浏览器提交 reroll action。
2. 服务确认 session 属于 story。
3. 服务确认 Mutable Tail 是系统回复。
4. 服务找到前一个玩家消息。
5. 编排服务用递增 variant index 重新运行 workflow。
6. 新 variant 写入并选中。

拒绝情况：空 session、最新楼层不是系统回复、story/session 不匹配。

## Fork 存档

| 字段 | 值 |
| --- | --- |
| Actor | 本地用户 |
| 前置条件 | source session 和 fork position 属于选中的 story |
| 成功结果 | 新 session 拥有复制出的聊天前缀和合适的 Wiki 快照 |

步骤：

1. 浏览器提交 source session、fork position 和可选 variant。
2. 服务确认 source session 属于 story。
3. 服务校验 fork position 和可选 reply variant。
4. 服务创建目标 Play Session。
5. 服务复制 fork 点之前的 conversation positions、player messages 和 reply variants。
6. Progress Wiki 服务复制不超过 fork 点的最新累计快照。
7. 服务创建 `user_data/stories/<story-id>/saves/<new-session-id>/wiki/`。

拒绝情况：source session 不属于 story；variant 不属于 fork 的系统回复楼；从玩家消息位置提交 variant。

## 编辑 Progress Wiki

| 字段 | 值 |
| --- | --- |
| Actor | 本地用户 |
| 前置条件 | Session 存在 |
| 成功结果 | Session-owned wiki document 被创建、更新、删除或快照化 |

步骤：

1. 浏览器提交 Progress Wiki 表单。
2. Server Action 调用 Progress Wiki 服务。
3. 服务校验 session/document ID 和字段。
4. 服务写入 `progress_wiki_documents` 或 `wiki_snapshots`。

副作用：SQLite 写入。文件系统 wiki 目录存在，但内容当前仍不是 file-backed。
