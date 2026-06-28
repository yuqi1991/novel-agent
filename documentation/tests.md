# 测试覆盖地图

## 现有覆盖

| 用例 | 规则 | 期望行为 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| 数据库迁移 | Schema 可干净应用 | 迁移能跑通 SQLite | `src/db/migration.test.ts` | 已覆盖 |
| 故事创建 | Story 有默认 settings | Story 和 settings 持久化 | `src/services/story-service.test.ts` | 已覆盖 |
| 故事目录 | 创建 Story 时创建本地目录 | `user_data/stories/<story-id>/saves` 存在 | `src/services/story-service.test.ts` | 已覆盖 |
| 存档隔离 | 同故事下不同 session 不共享聊天 | 一个 session 的 transcript 为空 | `src/services/session-service.test.ts` | 已覆盖 |
| 存档目录 | 创建 session 时创建 wiki 目录 | `saves/<session-id>/wiki` 存在 | `src/services/session-service.test.ts` | 已覆盖 |
| 第一轮玩家输入 | 玩家消息和回复持久化 | conversation positions、reply variant、trace steps 存在 | `src/services/session-service.test.ts` | 已覆盖 |
| 重掷 | 只有最新系统回复可变 | 新 variant 持久化并选中 | `src/services/session-service.test.ts`、`tests/e2e/reply-variants.spec.ts` | 已覆盖 |
| Fork | Fork 只复制选中前缀 | source 后续记录不进入 fork | `src/services/session-service.test.ts`、`tests/e2e/session-fork.spec.ts` | 已覆盖 |
| Wiki 快照 | Fork 复制合适记忆快照 | 快照边界正确 | `src/services/session-service.test.ts`、`src/services/progress-wiki-service.test.ts` | 已覆盖 |
| SillyTavern 导入 | JSON 转内部模型 | 角色和世界书写入 | `src/services/story-creation-service.test.ts`、`src/services/sillytavern-import-service.test.ts`、`tests/e2e/sillytavern-import.spec.ts` | 已覆盖 |
| 上下文组装 | context 包含近期聊天、资料、Wiki | Context Pack 形状正确 | `src/services/context-assembly-service.test.ts` | 已覆盖 |
| Agent 能力 | Subagent 只读，资料变更受控 | 非法 mutation 被拒绝 | `src/services/agent-capability-service.test.ts` | 已覆盖 |
| Runtime 配置 | repo-local `user_data` 配置可生成和加载 | workflow agents 从配置解析 | `src/services/agent-runtime/runtime-config.test.ts` | 已覆盖 |
| 编排 | 多 Agent 顺序传递输出 | 两个 Agent step 按顺序运行 | `src/services/orchestration-service.test.ts` | 已覆盖 |
| Trace Viewer | 游玩后可查看 trace | Runtime payload 可检查 | `src/services/trace-service.test.ts`、`tests/e2e/trace-viewer.spec.ts` | 已覆盖 |
| UI Shell | 故事库和面板可达 | 主要应用界面可访问 | `tests/e2e/story-library.spec.ts` 等 | 已覆盖 |

CI 的 `.github/workflows/ci.yml` 运行 typecheck、unit tests、build 和 e2e tests。

## 建议补充

| 用例 | 规则 | 期望行为 | 类型 |
| --- | --- | --- | --- |
| 真实 Pi smoke test | Pi Runtime 能调用已配置 Provider | 有本地密钥时 guarded live test 通过 | Guarded live |
| Provider auth 缺失 | Real runtime 给出可操作错误 | 缺密钥或模型时不写半截聊天 | 自动化 integration |
| Runtime 配置无效 | 错 YAML 或缺 Agent 清晰失败 | 不产生部分 conversation write | 自动化 integration |
| File-backed Wiki 迁移 | Wiki 文件 writer 成为内容来源 | Fork 和 snapshot 规则不变 | 自动化 integration |
| MCP/web search tools | 外部工具只分配给允许的 Agent | 未授权 Agent 不能调用工具 | 自动化 integration |
| Trace 隐私检查 | Trace 不包含 Provider secret | auth material 永不进入 trace payload | unit/manual review |

## 缺口

| 缺口 | 风险 |
| --- | --- |
| CI 没有 live provider | Pi adapter 主要通过结构和 Stub workflow 验证，CI 不碰真实 Provider。 |
| 没有成本/限流保护 | 真实 Provider workflow 配错后，消耗控制依赖 Provider 侧。 |
| 没有 file-backed Wiki 测试 | 目录已存在，但 Wiki 内容仍是 SQLite-backed。 |
| 没有 MCP/tool-call 测试 | 外部工具支持计划中，尚未接入 MVP 游玩。 |
| 没有多用户 auth 测试 | 当前设计无账号；未来加账号必须新增权限模型和测试。 |
