# Novel Agent MVP Issue 切片

这些切片把 PRD 拆成可独立交付、可演示、可测试的纵向任务。每个切片都应穿透 UI、服务、持久化和测试中的必要部分。

## 1. 本地 Web App 和 SQLite 启动骨架

构建 Next.js 本地 Web UI、SQLite/Drizzle 迁移、基础 app shell 和 smoke test。

验收：

- 应用可本地启动并打开 Web UI。
- SQLite 可通过可重复迁移初始化。
- 本地配置和运行数据有稳定目录。
- 有 smoke test 验证应用可在测试数据库上启动。

## 2. 故事库：创建和打开 Story

实现 Story 创建、列表和打开，证明 Story 生命周期。

验收：

- 用户可创建带名称和简介的 Story。
- Story Library 刷新后仍显示已创建 Story。
- 用户可从列表打开 Story。
- 测试覆盖 Story 创建和列表。

## 3. 故事资料编辑：角色和世界书条目

实现 Character Profiles、World Entries、Entry Inclusion Mode 和可选 Player Character。

验收：

- 用户可创建、编辑、删除 Character Profile。
- 用户可设置或清空 Player Character。
- 用户可创建、编辑、删除 World Entry。
- World Entry 支持 always、triggered、semantic、disabled。
- 测试覆盖资料持久化和玩家角色可选性。

## 4. SillyTavern 导入

导入 SillyTavern 角色卡和 world/lorebook JSON，保留原始 Imported Asset 并转换为内部模型。

验收：

- 用户可导入常见角色卡 JSON 或 PNG metadata。
- 原始角色卡保存为 Imported Asset。
- 角色卡转换为 Character Profile。
- 用户可导入 SillyTavern 世界书 JSON。
- 世界书保存为 Imported Asset 并转换为 World Entries。
- 测试覆盖代表性 fixture。

## 5. 游玩工作区：Session 和第一条系统回复

实现可玩的最小闭环：创建/切换 Play Session，输入玩家消息，运行最小 Generation Workflow，保存 Narrative Response。

验收：

- 用户可在一个 Story 下创建多个 Play Session。
- 不同 Play Session 的 Conversation Log 隔离。
- 用户可在 Play Workspace 发送玩家消息。
- 文件定义 workflow 能产生 Narrative Response。
- 玩家消息和 Reply Variant 刷新后仍存在。
- 测试覆盖 session 隔离和第一轮持久化。

## 6. 编排构建器：线性 Agent 配置

实现可复用 Orchestration Configuration 和有序 Agent Assignments。

验收：

- 用户可创建和删除 Orchestration Configuration。
- 用户可给配置添加有序 Agent Assignments。
- 文件定义 Agent 支持指令、标准 `SKILL.md`、timeout、provider/model 和 allowed tools。
- 全局 Model Defaults 可用于缺省 Agent。
- 测试覆盖配置持久化和文件 workflow 顺序。

## 7. Workflow Trace 和失败处理

记录 Generation Workflow attempt，并在失败时避免写入剧情聊天记录。

验收：

- 成功 workflow 记录 step 输入、输出、耗时、配置和最终结果。
- 失败 workflow 记录失败细节。
- 失败 workflow 不追加 Reply Variant 或 Narrative Response。
- Trace Viewer 可查看当前 Play Session 的 workflow attempt。
- 测试覆盖 trace 记录和失败排除。

## 8. Reply Variants 和 Mutable Tail Reroll

支持最新系统回复 reroll，保存所有 variants，并允许用户选择。

验收：

- 用户可为最新系统回复再生成一个 Reply Variant。
- UI 可切换 Mutable Tail 的 variants。
- 所有 variants 持久化。
- 下一轮上下文跟随当前 Selected Variant。
- 测试覆盖 variant 保存、选择和 Mutable Tail 限制。

## 9. 从历史楼层 Fork Session

从旧 Conversation Position 或旧 Reply Variant 创建新 Play Session。

验收：

- 用户可选择历史 Conversation Position 创建新 Play Session。
- 用户可从旧 Reply Variant fork，不修改 source session。
- 新 session 只继承 fork 点之前记录。
- source session 后续记录不进入 fork。
- 测试覆盖 selected path 和旧 variant 的 fork 继承。

## 10. Progress Wiki：编辑、快照和 Memory Boundary

实现 session-owned Progress Wiki、累计 Wiki Snapshot 和 fork 快照选择。

验收：

- 每个 Play Session 拥有独立 Progress Wiki。
- 用户可查看和编辑 Wiki 文档。
- 系统可在 Memory Boundary 创建累计 Wiki Snapshot。
- Fork 选择不超过 fork position 的最新 Wiki Snapshot。
- 测试覆盖 session 隔离、snapshot 创建和 fork 继承。

## 11. Context Assembly：近期聊天、Wiki 和 Story Material

实现确定性 Context Pack 组装。

验收：

- Context Pack 包含 selected path 的最近聊天。
- Context Pack 包含适用 Progress Wiki。
- Context Pack 包含 Character Profiles 和 Player Character。
- World Entries 按 inclusion mode 进入上下文。
- 测试覆盖各类输入组合。

## 12. Agent Runtime Adapter 和 Pi 集成

把 Pi 放到内部 `AgentRuntime` adapter 后面，并支持 Stub Runtime。

验收：

- 业务层不直接依赖 Pi 数据结构。
- Stub Runtime 用于自动化测试。
- Pi Runtime 读取 `user_data/providers/*` 和 `user_data/agents/*`。
- 缺少 Provider auth 时给出可操作错误。
- 测试覆盖 Runtime 配置加载和 workflow 执行。

## 13. Skill、Tool 和 Subagent 权限

实现 Agent skill set、受控 tool surface 和一级只读 Subagent。

验收：

- Agent 从标准 `SKILL.md` 读取 skill。
- 每个 Agent 有独立 skill set。
- Subagent 最大深度 1。
- Subagent 不能直接修改应用状态。
- 外部工具通过用户配置的 MCP 授权给指定 Agent。

## 14. 故事库和资料面板 UI 重构

实现类似 SillyTavern 的管理面板关系：顶部横向导航，中间聊天，侧边抽屉管理。

验收：

- 顶部有故事库、故事资料/世界书、Agent 管理、Agent 编排、存档管理、运行记录入口。
- 故事库先显示所有 Story，顶部小按钮切换列表/新建/导入。
- 新建或导入进入故事资料草稿，保存后才创建 Story 和默认 Session。
- 点击已有 Story 时，聊天窗口切到最后一次 Session，并打开故事资料面板。
- 存档管理面板包含聊天记录查看和 Progress Wiki 文件浏览/编辑。

## 15. 文档和项目整理

把仓库整理为多人协作和多 Agent 开发可接手的结构。

验收：

- README、AGENTS、CONTRIBUTING 说明安装、启动、验证和安全边界。
- 技术架构拆分为前端、后端、Agent Runtime 与数据说明。
- `documentation/` 说明当前实现、流程、变量、权限、测试和自动化。
- `user_data/`、本地密钥、数据库和私有角色卡全部 git ignore。
- CI 覆盖 typecheck、unit、build 和 e2e。
