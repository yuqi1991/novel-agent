# 权限模型

## 角色和范围

Novel Agent 当前只有一个隐含角色：本地用户。没有登录、账号、租户或远程授权模型。

资源范围来自 SQLite 中的关系：

- Play Session 通过 `play_sessions.story_id` 属于 Story。
- Conversation positions、player messages、reply variants、Progress Wiki docs 和 wiki snapshots 属于 Play Session。
- Character profiles、world entries、settings、imported assets 和 proposals 属于 Story。

应用依赖服务层检查，而不是数据库行级权限。

## 资源操作矩阵

| 资源 | 操作 | 本地用户 | Enforcement |
| --- | --- | --- | --- |
| Story | list/create/view/update | 允许 | Server Actions 和 `story-service` 校验 |
| Story Material | create/delete/update settings | 允许 | `story-material-service` 校验 story 和 profile/entry 归属 |
| Imported Asset | import 创建 | 允许 | `story-creation-service`、`sillytavern-import-service` 校验 |
| Play Session | create/list/default | story 内允许 | `session-service` 检查 story 存在 |
| Play Session | fork | source 属于 story 时允许 | `assertSessionBelongsToStory` 和 fork position 检查 |
| Conversation Log | append player turn | session 属于 story 时允许 | `assertSessionBelongsToStory`；生成失败回滚 |
| Reply Variant | reroll/select | 只允许最新系统回复 | `getMutableTailSystemPosition` 和 variant 归属检查 |
| Progress Wiki | create/list/update/delete/snapshot | session 内允许 | `progress-wiki-service` 校验 session/document 匹配 |
| Orchestration Configuration | UI 管理 | 允许 | Orchestration config service 校验 |
| File-defined Agents | 编辑本地文件 | 本地文件系统 owner | 不经 Web UI |
| Provider Auth | 编辑本地密钥文件或 env | 本地文件系统 owner | git ignore；Web UI 不暴露 |

## Agent 权限

Agent 可以读取应用传入的 Context Pack。当前游玩循环中，Agent 只把文本返回给编排服务，应用拥有持久化权。

Subagent 是只读辅助调用：它把结果返回父 Agent，不能直接写 Conversation Log、Progress Wiki 或 Story Material。

未来工具支持必须保留这个区分：

- Agent output 可以建议或起草。
- App services 校验并持久化。
- Shared Story Material mutation 需要 proposal/review 边界。
- Progress Wiki mutation 应该由专门的 Progress Wiki skill 边界管理。

## 必须保留的拒绝场景

- story-scoped action 不能接受其他 story 的 session ID。
- 只有最新系统回复能改变 selected reply variant。
- Reroll 必须有最新系统回复和前一条玩家消息。
- Fork variant selection 只对系统回复 fork 点有效。
- Progress Wiki document 更新/删除必须同时匹配 document ID 和 session ID。
