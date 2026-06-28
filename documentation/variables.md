# 变量和密钥

## Runtime 变量

| 名称 | 使用方 | 范围 | 来源 | 变更方式 | 风险 |
| --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | `src/db/client.ts`、Drizzle config | Server | Env，默认 `file:./user_data/novel-agent.db` | 替换 DB 文件或 URL | 控制持久数据库位置 |
| `NOVEL_AGENT_RUNTIME` | Agent runtime selector | Server | Env，测试默认 `stub`，非测试默认 `pi` | 修改 env 并重启 | `pi` 会把 context 发给外部 Provider |
| `NOVEL_AGENT_USER_DATA_DIR` | Runtime 配置和数据路径 | Server | Env，默认 `user_data` | 修改 env 并迁移/复制数据 | 指向 config、auth、agents、stories |
| `NOVEL_AGENT_PI_CWD` | Pi runtime | Server | Env 或 config | 重启 | 改变 Pi 项目工作目录 |
| `NOVEL_AGENT_PI_AGENT_DIR` | Pi runtime | Server | Env 或 config | 重启 | 改变 Pi agent resource root |
| `NOVEL_AGENT_PI_AUTH_PATH` | Pi auth storage | Server | Env 或 config | 替换 auth 文件 | 指向 Provider auth |
| `NOVEL_AGENT_PI_MODELS_PATH` | Pi model registry | Server | Env 或 config | 替换 models 文件 | 可改变 Provider endpoint |
| `NOVEL_AGENT_PI_NO_TOOLS` | Pi runtime tool availability | Server | Env 或 config | 重启 | false 会扩大 Runtime 能力面 |
| `PORT` | Next dev/start server | Server | Env | 重启 | 本地端口 |

## 本地配置文件

| 文件 | 是否追踪 | 用途 | 风险 |
| --- | --- | --- | --- |
| `user_data/config.yaml` | 否 | 默认 Runtime/provider/workflow 配置 | 可把游玩路由到不同 Agent/Provider |
| `user_data/providers/models.json` | 否 | Provider/model registry seed | 可定义外部 Provider endpoint |
| `user_data/providers/auth.json` | 否 | Provider credentials | 密钥，绝不提交 |
| `user_data/agents/*` | 否 | Agent system prompts、Skill 目录、workflow 资源 | Prompt 改动会影响生成行为 |
| `user_data/*.db` | 否 | 本地 SQLite 数据库 | 包含导入内容和聊天记录 |
| `user_data/stories/` | 否 | 运行期 story/save/wiki 目录 | file-backed 能力扩展后会包含玩家数据 |

## 客户端暴露

Provider 密钥不会有意打包到客户端。Provider auth 只由服务端 Pi runtime adapter 读取。浏览器可见数据包括故事资料、聊天消息、Wiki 文档和本地 UI 展示的 trace details。

## 交付前检查

- 必须避免外部 Provider 调用的 demo 使用 `NOVEL_AGENT_RUNTIME=stub`。
- 只有明确配置密钥后才使用 `NOVEL_AGENT_RUNTIME=pi`。
- 确认 `user_data/` 被 ignore 且未 staged。
- 确认私有导入角色卡未提交。
- 分享本地数据库前检查 trace 可见性；trace 包含 prompts 和 context packs。
