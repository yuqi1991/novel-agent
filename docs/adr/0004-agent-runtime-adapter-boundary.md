# Keep Agent Runtime Behind an Adapter

Novel Agent defines an internal Agent Runtime boundary and treats pi-agent as an adapter candidate rather than a domain dependency. The Role-Play Domain owns Stories, Play Sessions, Context Packs, Progress Wikis, Reply Variants, and Orchestration Configurations; the runtime adapter owns conversion to provider calls, tool calls, skills, and one-level Subagents so the runtime can be replaced without rewriting product concepts.
