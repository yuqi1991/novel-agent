import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import {
  agentAssignments,
  orchestrationConfigurations,
  workflowTraces,
  workflowTraceSteps
} from "@/db/schema";

const idSchema = z.string().trim().min(1, "Id is required");

export async function listWorkflowTracesForSession(sessionId: string, database: Database = db) {
  const parsedSessionId = idSchema.parse(sessionId);
  const traces = await database
    .select()
    .from(workflowTraces)
    .where(eq(workflowTraces.sessionId, parsedSessionId))
    .orderBy(desc(workflowTraces.startedAt));
  const steps = await database
    .select()
    .from(workflowTraceSteps)
    .orderBy(asc(workflowTraceSteps.orderIndex), asc(workflowTraceSteps.startedAt));
  const configurations = await database.select().from(orchestrationConfigurations);
  const assignments = await database.select().from(agentAssignments);

  const configurationById = new Map(configurations.map((configuration) => [configuration.id, configuration]));
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));

  return traces.map((trace) => ({
    ...trace,
    configuration: trace.orchestrationConfigurationId
      ? configurationById.get(trace.orchestrationConfigurationId) ?? null
      : null,
    steps: steps
      .filter((step) => step.workflowTraceId === trace.id)
      .map((step) => ({
        ...step,
        assignment: step.agentAssignmentId ? assignmentById.get(step.agentAssignmentId) ?? null : null
      }))
  }));
}
