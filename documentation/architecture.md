# 已实现架构地图

## 产品概览

Novel Agent 是本地单用户 Web UI，用于单人文字 RP。用户可以导入或创建故事，在每个故事下管理多个存档，进入存档聊天，重掷最新系统回复，从历史楼层 fork 新存档，并查看多 Agent workflow 的运行记录。

当前是 MVP。SQLite 是权威结构化存储。git 忽略的 `user_data/` 是本仓库内的运行数据根目录，用于数据库、Provider 配置、Agent 文件和故事/存档目录。

## 技术栈

| 区域 | 选择 |
| --- | --- |
| UI | Next.js App Router、React 19 |
| Server Actions | `src/app/*-actions.ts` |
| 数据库 | SQLite/libSQL |
| ORM/迁移 | Drizzle ORM，迁移在 `drizzle/` |
| 测试 | Vitest 服务测试、Playwright e2e |
| Agent Runtime | `@earendil-works/pi-coding-agent` adapter + 确定性 Stub Runtime |
| Runtime 配置 | `user_data/config.yaml`、`user_data/agents/*`、`user_data/providers/*` |

## 主要模块

| 模块 | 路径 | 职责 |
| --- | --- | --- |
| Web UI | `src/app/` | 故事库、故事工作区、面板、表单、Server Actions |
| 数据库 | `src/db/` | Schema、client、迁移 runner |
| 故事服务 | `src/services/story-*` | 故事 CRUD、故事资料、SillyTavern 草稿创建 |
| 存档服务 | `src/services/session-service.ts` | Play Session、聊天记录、玩家回合、重掷、分叉 |
| 上下文组装 | `src/services/context-assembly-service.ts` | 从资料、世界书、最近聊天和 Wiki 组装 Context Pack |
| 编排服务 | `src/services/orchestration-service.ts` | 运行文件定义线性 workflow 并记录 trace |
| Agent Runtime | `src/services/agent-runtime/` | repo-local Runtime 配置、Pi adapter、Stub Runtime |
| Progress Wiki | `src/services/progress-wiki-service.ts` | 存档绑定 Wiki 文档和累计快照，当前 SQLite-backed |
| Trace 服务 | `src/services/trace-service.ts` | 为 UI 读取 workflow trace |
| 用户数据存储 | `src/services/user-data-storage.ts` | 创建本地 story/save/wiki 目录 |

## 运行数据布局

```text
user_data/
  config.yaml
  novel-agent.db
  providers/
    models.json
    auth.json
  agents/
    <agent-id>/agent.yaml
    <agent-id>/system.md
    <agent-id>/skills/<skill-id>/SKILL.md
    <agent-id>/prompts/
  stories/<story-id>/saves/<session-id>/wiki/
  lorebooks/
```

`user_data/` 全部被 git 忽略。Runtime 缺少默认文件时会自动创建模板。

## 请求和状态流

没有账号系统，也没有网络鉴权边界。浏览器表单提交到 Server Actions。Server Actions 调用服务层 schema 校验并写入 SQLite。游玩生成时，编排服务组装上下文，读取 repo-local workflow 配置，顺序运行 Agent，记录 workflow trace，并把最终结果追加为 reply variant。

## 信任边界

| 边界 | 当前行为 | 风险 |
| --- | --- | --- |
| 浏览器到 Server Action | 服务层校验 ID 和归属关系，例如 session 必须属于 story。 | 单用户假设下没有用户身份检查。 |
| Server 到 SQLite | 所有写入由服务层负责。 | 没有数据库行级权限，正确性依赖服务检查和测试。 |
| Server 到 Pi/Provider | `NOVEL_AGENT_RUNTIME=pi` 时可能调用外部 LLM Provider。 | Prompt/context 可能包含导入资料和聊天历史。 |
| Agent 到应用状态 | Agent 返回文本；应用服务决定是否持久化。 | 未来工具必须把 mutation guardrail 放在服务层，而不是只靠 prompt。 |
| 本地文件系统 | `user_data/` 保存 Provider 密钥和本地数据。 | 拥有本地文件访问权就等于拥有应用数据访问权。 |

## 已知风险和假设

- 无账号系统：所有数据都是本地用户自己的。
- Provider 密钥位于 git 忽略的 `user_data/providers/auth.json` 或环境变量；Web UI 不管理密钥。
- Progress Wiki 内容当前存 SQLite；文件目录已经创建，但不是内容来源。
- 活跃游玩 workflow 当前从 `user_data/config.yaml` 读取；UI 编排配置仍用于管理和未来选择。
- `next build` 可能输出 Runtime 配置动态文件读取 warning；构建和 e2e 可以通过。
- MCP/web search 等外部工具尚未接入核心游玩循环。

## 相关文档

- `README.md`：安装、启动、命令和项目结构。
- `AGENTS.md`：编码 Agent 操作上下文。
- `CONTRIBUTING.md`：贡献流程。
- `docs/technical-architecture.md`：技术架构总览。
- `docs/frontend-architecture.md`：前端架构。
- `docs/backend-architecture.md`：后端架构。
- `docs/agent-runtime-and-data.md`：Agent Runtime 与数据架构。
- `docs/novel-agent-design.md`：产品/领域设计说明。
- `docs/glossary.md`：领域术语。
- `documentation/flows.md`：跨边界和副作用流程。
- `documentation/permissions.md`：权限和资源操作矩阵。
- `documentation/variables.md`：变量和密钥。
- `documentation/tests.md`：测试覆盖地图。
- `documentation/automation.md`：内嵌 Agent workflow 地图。

无邮件系统：没有 `emails.md`。
无定时任务：没有 `cron.md`。
本地应用没有公开 SEO 页面：没有 `seo.md`。
