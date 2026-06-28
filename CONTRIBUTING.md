# 贡献指南

Novel Agent 当前是本地优先的 MVP。贡献目标是让代码容易被人类 reviewer 和编码 Agent 审阅。

## 本地准备

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

## 提交 PR 前

运行：

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

如果某个检查无法运行，需要说明原因，以及你用了哪些本地证据替代。

## 改动原则

- 改动范围聚焦在当前功能或 bug。
- 触碰持久化、导入、编排、Agent Runtime 或 UI 流程时，补充或更新测试。
- 行为、安装、数据布局或安全边界变化时，同步更新 `README.md`、`AGENTS.md`、`docs/` 或 `documentation/`。
- 修改数据库 schema 后，用 `npm run db:generate` 生成 Drizzle 迁移。
- 不提交本地密钥、数据库、构建产物或私有角色卡。

## 文档规则

- 产品意图和设计决策放在 `docs/`。
- reviewer / auditor / 新开发 Agent 的实现交接文档放在 `documentation/`。
- 编码 Agent 的操作上下文放在 `AGENTS.md`。

文档要写事实。计划中但未实现的能力必须明确标注。
