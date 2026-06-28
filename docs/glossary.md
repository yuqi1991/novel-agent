# 术语表

本文统一 Novel Agent 的产品语言，避免把故事创作、导入资产、游玩存档和 Agent 编排概念混在一起。

## 核心术语

**Story**：用户拥有的可游玩 RP 故事容器，包含背景、角色和多个存档共享的世界资料。避免称为 campaign、project、chat。

**Play Session**：Story 下的隔离游戏存档，包含一个分支的聊天历史和演化状态。避免称为 chat、thread。

**Session Fork**：从已有 Play Session 某个 Conversation Position 创建的新 Play Session。

**Player Character**：用户游玩时扮演的角色。

**Non-Player Character**：由系统演绎的故事角色。

**Conversation Log**：Play Session 中有序保存的消息和系统事件，是该分支发生过什么的原始事实来源。

**Conversation Position**：Play Session 中的一个编号位置，用于 reroll、fork、记忆边界和快照。

**Narrative Response**：系统在一轮游玩中给用户看的单段统一回复，包含叙事、对白和结果。

**Reply Variant**：同一个系统回复楼的一个生成候选。

**Selected Variant**：当前被选中的 Reply Variant。

**Selected Path**：由每个位置的 Selected Variant 形成的当前有效聊天路径。

**Mutable Tail**：Play Session 最新系统回复位置，可原地 reroll 或切换 variant。

**Fork Source Range**：Session Fork 从 source session 继承的前缀范围，截止到选定 Conversation Position。

## 故事资料

**Story Material**：属于 Story 的内部结构化资料，可由用户创建或从导入资产转换而来。

**Imported Asset**：导入系统的原始外部文件或 metadata payload，用于兼容性和可追溯性。

**Character Profile**：定义 Player Character 或 Non-Player Character 的 Story Material，包括身份、人设、行为约束和表现细节。

**World Entry**：描述世界知识的 Story Material，例如地点、派系、规则、历史或局势事实。

**Entry Inclusion Mode**：World Entry 进入 Context Pack 的规则，包括 always、triggered、semantic、disabled。

**SillyTavern Character Import**：导入常见 SillyTavern 角色卡 JSON 或 PNG metadata，并转成 Character Profile。

**SillyTavern World Import**：导入 SillyTavern world/lorebook JSON，并转成 World Entries。

## 记忆

**Progress Wiki**：Play Session 拥有的长期记忆文档库，记录稳定事实、剧情进度、人物变化和世界变化。

**Memory Boundary**：已经进入 Progress Wiki snapshot 的最高 Conversation Position，代表长期记忆整理到哪里。

**Wiki Snapshot**：某个 Memory Boundary 上完整版本的 Progress Wiki，用于恢复或 fork。

**Memory Curation Skill**：记忆 Agent 使用的 Skill，规定如何把 Conversation Log 范围整理进 Progress Wiki。

## Agent 和编排

**Orchestration Configuration**：可复用的 Agent 编排配置，不绑定 Story。

**Agent Role**：Agent 在编排中的职责，例如剧情编排、世界推演、记忆整理、文字润色或资料检索。

**Agent Assignment**：Orchestration Configuration 中的一个具体 Agent 步骤，包含模型、指令、Skill、工具、timeout 和顺序。

**Skill Set**：某个 Agent Assignment 可用的 Skill 集合。

**Tool**：Runtime 暴露给 Agent 的可调用能力，例如 MCP/web search。

**Subagent**：Agent 在一次推理中召唤的短生命周期辅助 Agent，MVP 只允许一级。

**Subagent Result**：Subagent 返回给父 Agent 的只读结果，例如 findings、drafts、candidates。

**Generation Workflow**：为一个游玩回合生成 Narrative Response 的完整多 Agent 执行。

**Workflow Run**：一次 Orchestration Configuration 执行。

**Linear Workflow**：Agent Assignments 按用户配置顺序执行，上一环输出传给下一环。

**Agent Output**：Agent Assignment 输出的字符串结果，系统层不强制 schema。

**Agent Timeout**：Agent Assignment 完成其步骤的时间上限。

**Workflow Failure**：某个 Agent 失败或 timeout，导致本次 Generation Workflow 不产生 Narrative Response。

**Workflow Trace**：记录 workflow attempt 的诊断数据，包括每步输入、输出、耗时和失败。

**Trace Viewer**：用户查看 Workflow Trace 的高级调试界面。

## 架构

**Agent Runtime**：底层执行层，负责调用 LLM provider、tool、skill 和 subagent。

**Multi-Agent Scheduler**：编排层，负责 Agent 顺序、消息传递和 workflow trace。

**Role-Play Domain**：产品领域层，拥有 Story、Session、Story Material、Progress Wiki、Context Pack 和玩家可见行为。

**Context Pack**：一次 Agent 推理的输入集合，包括近期聊天、相关 Wiki、Story Material、World Entries、Player Character 和任务指令。

**Writing Team Mode**：MVP 模式，Agent 是功能性写作团队成员。

**Village Mode**：未来模式，一个 Agent 独立扮演一个 NPC 或世界行动者。

**Single-User Local App**：MVP 部署模型，一个本地用户管理所有故事、存档和配置，无账号系统。
