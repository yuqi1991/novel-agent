# 编码 Agent 指南

这是新开发 Agent 进入本仓库时的入口文档。

## 先读这些

1. `README.md`：安装、启动、命令和项目结构。
2. `documentation/architecture.md`：当前已经实现的系统地图。
3. `docs/technical-architecture.md`：技术架构总览和拆分文档入口。
4. `docs/glossary.md`：领域术语。
5. `docs/issues/mvp-issue-slices.md`：MVP 切片和剩余工作。

## 当前实现规则

- 所有本地 Runtime 配置和可变应用数据都必须放在 git 忽略的 `user_data/`。
- 不要重新引入对 `~/.pi/agent` 的依赖。
- 编排逻辑不能写死 Agent 名称；示例 Agent 只作为缺省模板生成在 `user_data/agents/`。
- 文件定义 Skill 必须位于 `skills/<skill-id>/SKILL.md`，并包含 `name` 和 `description` frontmatter。
- SQLite 是当前 MVP 的权威结构化存储。
- 原始聊天记录是剧情事实来源；Progress Wiki 是由存档维护的派生、可编辑记忆。
- Progress Wiki 内容当前仍存 SQLite；`user_data/stories/<story-id>/saves/<session-id>/wiki/` 是预留的文件化布局。
- Subagent 是只读辅助执行者，只能把结果返回给父 Agent，不能直接修改应用状态。

## 验证要求

多数代码改动后运行：

```bash
npm run typecheck
npm test
```

以下改动交付前还要运行：

```bash
npm run build
npm run test:e2e
```

适用范围：UI、持久化、导入、编排、Runtime、会话和记忆 Wiki。

`npm run build` 可能输出 Runtime 配置动态文件读取相关的 Turbopack warning。失败是阻塞；warning 是已知技术债，除非你的改动触碰 Runtime 配置加载。

## 文件定位

- UI 路由和面板：`src/app/`
- Server Actions：`src/app/*-actions.ts`
- 数据库 schema：`src/db/schema.ts`
- 迁移：`drizzle/`
- 故事、存档、聊天逻辑：`src/services/story-service.ts`、`src/services/session-service.ts`
- SillyTavern 导入：`src/services/sillytavern-import-service.ts`、`src/services/story-creation-service.ts`
- 多 Agent 编排：`src/services/orchestration-service.ts`
- Runtime adapter：`src/services/agent-runtime/`
- Progress Wiki：`src/services/progress-wiki-service.ts`
- Trace Viewer 数据：`src/services/trace-service.ts`

## 安全边界

- 不要提交 `user_data/`、`.env*`、`.next/`、`test-results/` 或私有导入卡。
- 仓库根目录的 `莉莉儿.json` 是本地手工测试文件，故意不追踪。
- 工作区可能已有用户或其他 Agent 的未提交改动；除非用户明确要求，不要回滚不属于你的改动。
