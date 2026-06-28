# 把 Agent Runtime 放在 Adapter 边界之后

Novel Agent 定义内部 `AgentRuntime` 边界，把 pi-agent 视为 adapter，而不是 RP 业务层依赖。

RP 领域拥有 Stories、Play Sessions、Context Packs、Progress Wikis、Reply Variants 和 Orchestration Configurations。Runtime adapter 负责转换到 Provider calls、tool calls、skills 和一级 Subagents。

这样未来替换 Runtime 时，不需要重写产品概念和业务服务。
