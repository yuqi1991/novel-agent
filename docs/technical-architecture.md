# 技术架构总览

本文是 Novel Agent MVP 的技术架构入口。详细内容已拆分为三份文档，方便前端、后端和 Agent Runtime 分别开发与 review。

## 文档拆分

- [前端架构](frontend-architecture.md)：页面关系、抽屉面板、故事库、故事资料编辑、聊天工作区和 UI 测试边界。
- [后端架构](backend-architecture.md)：Next.js Server Actions、服务层、SQLite/Drizzle、会话、存档、导入和 Progress Wiki。
- [Agent Runtime 与数据架构](agent-runtime-and-data.md)：`user_data/` 布局、Pi Runtime adapter、文件定义 Agent、Skill、Provider 配置和多 Agent 调度。

## 当前技术栈

| 层 | 选择 |
| --- | --- |
| 语言 | TypeScript |
| Web UI | Next.js App Router + React |
| 本地后端 | Next.js Server Actions |
| 数据库 | SQLite/libSQL |
| ORM | Drizzle ORM |
| Runtime | `@earendil-works/pi-coding-agent` adapter + 测试 Stub |
| 测试 | Vitest + Playwright |
| 本地配置和数据 | git 忽略的 `user_data/` |

## 分层原则

1. **RP 业务层**管理故事、角色、世界书、存档、聊天记录、回复变体、分叉和 Progress Wiki。
2. **多 Agent 调度层**读取用户配置的线性工作流，组装上下文，顺序运行 Agent，记录 Trace。
3. **Agent Runtime 层**负责真实模型调用、Skill 注入、工具调用和一级 Subagent。

业务层不能直接依赖 Pi 的数据结构。所有 Runtime 差异都要隔离在 `src/services/agent-runtime/`。

## MVP 关键约束

- 单人本地应用，无账号系统。
- 编排配置不绑定故事；每轮输出是一次独立 workflow。
- 当前核心工作流从 `user_data/config.yaml` 读取，不能在代码里写死 Agent 名称。
- 用户高级配置通过本地文件维护：`user_data/agents/<agent-id>/agent.yaml`、`system.md`、`skills/<skill-id>/SKILL.md`。
- Skill 必须使用标准 `SKILL.md` 入口，frontmatter 包含 `name` 和 `description`。
- 原始聊天记录是事实来源；Progress Wiki 是派生记忆，可编辑、可快照。
- Subagent 只能把结果返回主 Agent，不能直接改应用状态。
- Provider 密钥只放在 git 忽略的 `user_data/providers/auth.json` 或环境变量中。

## 当前已知技术债

- Progress Wiki 内容仍是 SQLite-backed；文件目录已预留，尚未切为文件内容源。
- MCP/web search 外部工具配置尚未接入核心游玩 workflow。
- UI 编排管理器和文件定义 workflow 之间仍有过渡期双轨。
- `next build` 可能报告 Runtime 配置动态读取相关的 Turbopack tracing warning。

## ADR

架构决策记录位于 `docs/adr/`：

- 0001：SQLite 作为主存储。
- 0002：Next.js App Router 作为 Web UI。
- 0003：Drizzle 管理 SQLite schema 和迁移。
- 0004：Agent Runtime Adapter 边界。
- 0005：MCP 外部工具配置方向。
- 0006：MVP 使用 Issue 切片推进开发。
