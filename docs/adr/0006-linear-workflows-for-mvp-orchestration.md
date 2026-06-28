# MVP 编排使用线性 Workflow

Novel Agent MVP 的 Orchestration Configurations 按用户配置的线性顺序运行 Agent Assignments。

任意图编排或共享黑板协作先延后。第一版需要可调试、可追踪的 Generation Workflow：每个 Agent Output 明确传给下游，失败也容易在 Workflow Trace 中定位。
