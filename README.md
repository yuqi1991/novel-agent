# Novel Agent

Novel Agent 是一个本地单人文字 Role-Play 游戏框架。它支持导入 SillyTavern 角色卡和世界书，管理多个故事和多个独立存档，并把每一轮玩家输入交给可配置的多 Agent 写作工作流处理。

当前 MVP 是一个 Next.js Web UI + SQLite 的本地应用。默认游玩工作流从 git 忽略的 `user_data/` 读取配置，并顺序运行两个示例 Agent：

1. `plot-designer`：规划下一段剧情推进。
2. `literary-writer`：生成最终中文 RP 正文。

## 当前能力

- 本地单用户应用，无账号系统。
- 故事库支持新建故事、打开故事、导入 SillyTavern 角色卡/世界书。
- 故事工作区包含聊天、存档、重掷回复、从历史楼层分叉、故事资料、存档管理、记忆 Wiki、Agent 编排和运行记录。
- SQLite 是结构化事实来源；原始聊天记录是剧情事实来源。
- 非测试环境默认使用 Pi Runtime；自动化测试使用确定性 Stub Runtime。
- Agent 定义、Skill、模型列表、Provider 密钥和运行数据都集中在本仓库的 `user_data/`，并且不会提交到 git。

## 环境要求

- Node.js 22 或更新版本
- npm
- Playwright 浏览器：

```bash
npx playwright install
```

## 安装与启动

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

打开 `http://127.0.0.1:3000`。

如果只是本地验证流程、不想配置 LLM Provider，在 `.env.local` 中保留：

```bash
NOVEL_AGENT_RUNTIME=stub
```

如果要真实调用模型，把它改成：

```bash
NOVEL_AGENT_RUNTIME=pi
```

然后在本地任选一种方式配置 Provider 密钥：

1. 写入 `user_data/providers/auth.json`。
2. 使用 Pi 支持的 Provider 环境变量，例如 `DEEPSEEK_API_KEY`。

DeepSeek 的 `auth.json` 示例：

```json
{
  "deepseek": { "type": "api_key", "key": "sk-..." }
}
```

首次加载 Runtime 时，应用会自动创建默认 `user_data/config.yaml`、`user_data/providers/models.json`、两个示例 Agent，以及空的 `user_data/providers/auth.json`。

## 常用命令

```bash
npm run dev          # 启动 Next.js 开发服务器
npm run build        # 生产构建
npm run start        # 构建后启动生产服务器
npm run typecheck    # TypeScript 检查
npm test             # Vitest 单元/服务测试
npm run test:e2e     # Playwright 端到端测试
npm run db:migrate   # 应用 Drizzle 迁移
npm run db:generate  # 修改 schema 后生成迁移
```

## 项目结构

```text
src/app/                 Next.js App Router 页面、面板和 Server Actions
src/db/                  Drizzle schema、数据库 client、迁移 runner
src/domain/              领域辅助函数
src/services/            应用服务和相邻测试
src/services/agent-runtime/
                          Pi Runtime adapter、Stub Runtime、repo-local 配置加载
tests/e2e/               Playwright 端到端测试
tests/fixtures/          导入测试 fixture
drizzle/                 生成的数据库迁移
docs/                    PRD、设计、架构、ADR、Issue 切片
documentation/           给 reviewer 和开发 Agent 的实现说明
user_data/               本地运行配置、密钥、示例 Agent、故事数据和数据库；已 git ignore
```

## 本地数据结构

```text
user_data/
  config.yaml
  providers/
    models.json
    auth.json              # 本地密钥
  agents/
    <agent-id>/
      agent.yaml
      system.md
      skills/<skill-id>/SKILL.md
      prompts/
  stories/                 # 运行期故事/存档目录
  lorebooks/               # 运行期世界书文件目录
  novel-agent.db           # SQLite 数据库
```

Skill 必须使用标准 `SKILL.md` 入口格式：

```markdown
---
name: rp-prose-writing
description: Write the final Chinese role-play prose response from a plan.
---

Skill instructions go here.
```

## 开发流程

1. 编码 Agent 先读 `AGENTS.md`。
2. 做较大改动前读 `docs/technical-architecture.md` 和 `documentation/architecture.md`。
3. 优先做聚焦改动，并在触碰的服务或 e2e 流程旁补测试。
4. 常规改动后运行 `npm run typecheck && npm test`。
5. UI、持久化、导入、编排或 Runtime 改动交付前运行 `npm run build && npm run test:e2e`。

已知构建提示：`next build` 可能输出 Turbopack 对 Runtime 配置动态文件读取的 tracing warning。当前构建和 e2e 可以通过；该 warning 作为技术债跟踪。

## 文档索引

- [MVP PRD](docs/mvp-prd.md)
- [产品设计说明](docs/novel-agent-design.md)
- [术语表](docs/glossary.md)
- [技术架构总览](docs/technical-architecture.md)
- [前端架构](docs/frontend-architecture.md)
- [后端架构](docs/backend-architecture.md)
- [Agent Runtime 与数据架构](docs/agent-runtime-and-data.md)
- [Pi Runtime 配置](docs/pi-runtime-setup.md)
- [Issue 切片](docs/issues/mvp-issue-slices.md)
- [ADR](docs/adr)
- [已实现架构地图](documentation/architecture.md)
- [自动化地图](documentation/automation.md)
- [测试覆盖地图](documentation/tests.md)

## Git 规则

不要提交本地数据库、Provider 密钥、私有角色卡、`.next/`、测试报告或 `user_data/` 中的任何内容。`.gitignore` 已覆盖标准路径；如果某个生成文件可疑，用 `git status --short --ignored` 检查。
