import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { db } from "@/db/client";
import { playSessions, progressWikiDocuments, wikiSnapshots } from "@/db/schema";
import { newId } from "@/domain/ids";

type DbExecutor = Pick<Database, "select" | "insert">;

const idSchema = z.string().trim().min(1, "Id is required");

export const createProgressWikiDocumentInput = z.object({
  sessionId: idSchema,
  title: z.string().trim().min(1, "Wiki document title is required").max(160),
  documentType: z.string().trim().min(1).max(80).optional().default("note"),
  body: z.string().trim().max(50_000).optional().default(""),
  tagsJson: z.string().trim().optional().default("[]")
});

export const updateProgressWikiDocumentInput = z.object({
  sessionId: idSchema,
  documentId: idSchema,
  title: z.string().trim().min(1, "Wiki document title is required").max(160),
  documentType: z.string().trim().min(1).max(80).optional().default("note"),
  body: z.string().trim().max(50_000).optional().default(""),
  tagsJson: z.string().trim().optional().default("[]")
});

export const deleteProgressWikiDocumentInput = z.object({
  sessionId: idSchema,
  documentId: idSchema
});

export const createWikiSnapshotInput = z.object({
  sessionId: idSchema,
  memoryBoundaryPosition: z.coerce.number().int().min(0)
});

export type CreateProgressWikiDocumentInput = z.input<typeof createProgressWikiDocumentInput>;
export type UpdateProgressWikiDocumentInput = z.input<typeof updateProgressWikiDocumentInput>;
export type DeleteProgressWikiDocumentInput = z.input<typeof deleteProgressWikiDocumentInput>;
export type CreateWikiSnapshotInput = z.input<typeof createWikiSnapshotInput>;

export async function listProgressWiki(sessionId: string, database: Database = db) {
  const parsedSessionId = idSchema.parse(sessionId);
  const [documents, snapshots] = await Promise.all([
    database
      .select()
      .from(progressWikiDocuments)
      .where(eq(progressWikiDocuments.sessionId, parsedSessionId))
      .orderBy(asc(progressWikiDocuments.createdAt), asc(progressWikiDocuments.title)),
    database
      .select()
      .from(wikiSnapshots)
      .where(eq(wikiSnapshots.sessionId, parsedSessionId))
      .orderBy(desc(wikiSnapshots.memoryBoundaryPosition), desc(wikiSnapshots.createdAt))
  ]);

  return { documents, snapshots };
}

export async function createProgressWikiDocument(
  input: CreateProgressWikiDocumentInput,
  database: Database = db
) {
  const parsed = createProgressWikiDocumentInput.parse(input);
  await assertSessionExists(parsed.sessionId, database);

  const id = newId("wiki");
  await database.insert(progressWikiDocuments).values({
    id,
    sessionId: parsed.sessionId,
    title: parsed.title,
    documentType: parsed.documentType,
    body: parsed.body,
    tagsJson: normalizeJsonText(parsed.tagsJson, "[]")
  });

  const [document] = await database
    .select()
    .from(progressWikiDocuments)
    .where(eq(progressWikiDocuments.id, id))
    .limit(1);
  if (!document) {
    throw new Error("Progress Wiki document was not persisted");
  }
  return document;
}

export async function updateProgressWikiDocument(
  input: UpdateProgressWikiDocumentInput,
  database: Database = db
) {
  const parsed = updateProgressWikiDocumentInput.parse(input);

  await database
    .update(progressWikiDocuments)
    .set({
      title: parsed.title,
      documentType: parsed.documentType,
      body: parsed.body,
      tagsJson: normalizeJsonText(parsed.tagsJson, "[]"),
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(
      and(
        eq(progressWikiDocuments.id, parsed.documentId),
        eq(progressWikiDocuments.sessionId, parsed.sessionId)
      )
    );

  const [document] = await database
    .select()
    .from(progressWikiDocuments)
    .where(
      and(
        eq(progressWikiDocuments.id, parsed.documentId),
        eq(progressWikiDocuments.sessionId, parsed.sessionId)
      )
    )
    .limit(1);
  if (!document) {
    throw new Error("Progress Wiki document was not found");
  }
  return document;
}

export async function deleteProgressWikiDocument(
  input: DeleteProgressWikiDocumentInput,
  database: Database = db
) {
  const parsed = deleteProgressWikiDocumentInput.parse(input);

  await database
    .delete(progressWikiDocuments)
    .where(
      and(
        eq(progressWikiDocuments.id, parsed.documentId),
        eq(progressWikiDocuments.sessionId, parsed.sessionId)
      )
    );
}

export async function createWikiSnapshot(input: CreateWikiSnapshotInput, database: Database = db) {
  const parsed = createWikiSnapshotInput.parse(input);
  const documents = await database
    .select()
    .from(progressWikiDocuments)
    .where(eq(progressWikiDocuments.sessionId, parsed.sessionId))
    .orderBy(asc(progressWikiDocuments.createdAt), asc(progressWikiDocuments.title));
  await assertSessionExists(parsed.sessionId, database);

  const id = newId("snapshot");
  await database.insert(wikiSnapshots).values({
    id,
    sessionId: parsed.sessionId,
    memoryBoundaryPosition: parsed.memoryBoundaryPosition,
    snapshotPayloadJson: JSON.stringify({
      memoryBoundaryPosition: parsed.memoryBoundaryPosition,
      documents: documents.map((document) => ({
        title: document.title,
        documentType: document.documentType,
        body: document.body,
        tagsJson: document.tagsJson,
        sourceDocumentId: document.id
      }))
    })
  });

  const [snapshot] = await database.select().from(wikiSnapshots).where(eq(wikiSnapshots.id, id)).limit(1);
  if (!snapshot) {
    throw new Error("Wiki Snapshot was not persisted");
  }
  return snapshot;
}

export async function copyEligibleWikiSnapshotForFork(
  input: { sourceSessionId: string; targetSessionId: string; forkPosition: number },
  database: DbExecutor = db
) {
  const sourceSessionId = idSchema.parse(input.sourceSessionId);
  const targetSessionId = idSchema.parse(input.targetSessionId);

  const [snapshot] = await database
    .select()
    .from(wikiSnapshots)
    .where(
      and(
        eq(wikiSnapshots.sessionId, sourceSessionId),
        lte(wikiSnapshots.memoryBoundaryPosition, input.forkPosition)
      )
    )
    .orderBy(desc(wikiSnapshots.memoryBoundaryPosition), desc(wikiSnapshots.createdAt))
    .limit(1);

  if (!snapshot) {
    return null;
  }

  const newSnapshotId = newId("snapshot");
  await database.insert(wikiSnapshots).values({
    id: newSnapshotId,
    sessionId: targetSessionId,
    memoryBoundaryPosition: snapshot.memoryBoundaryPosition,
    snapshotPayloadJson: snapshot.snapshotPayloadJson
  });

  const snapshotDocuments = parseSnapshotDocuments(snapshot.snapshotPayloadJson);
  for (const document of snapshotDocuments) {
    await database.insert(progressWikiDocuments).values({
      id: newId("wiki"),
      sessionId: targetSessionId,
      title: document.title,
      documentType: document.documentType,
      body: document.body,
      tagsJson: normalizeJsonText(document.tagsJson, "[]")
    });
  }

  const [copiedSnapshot] = await database
    .select()
    .from(wikiSnapshots)
    .where(eq(wikiSnapshots.id, newSnapshotId))
    .limit(1);
  return copiedSnapshot ?? null;
}

async function assertSessionExists(sessionId: string, database: Pick<Database, "select">) {
  const [session] = await database.select({ id: playSessions.id }).from(playSessions).where(eq(playSessions.id, sessionId)).limit(1);
  if (!session) {
    throw new Error("Play Session not found");
  }
}

function normalizeJsonText(value: string, fallback: string) {
  try {
    JSON.parse(value);
    return value;
  } catch {
    return fallback;
  }
}

function parseSnapshotDocuments(snapshotPayloadJson: string) {
  const payload = JSON.parse(snapshotPayloadJson) as {
    documents?: Array<{
      title?: unknown;
      documentType?: unknown;
      body?: unknown;
      tagsJson?: unknown;
    }>;
  };

  return (payload.documents ?? []).map((document) => ({
    title: typeof document.title === "string" && document.title.trim() ? document.title : "Untitled",
    documentType:
      typeof document.documentType === "string" && document.documentType.trim()
        ? document.documentType
        : "note",
    body: typeof document.body === "string" ? document.body : "",
    tagsJson: typeof document.tagsJson === "string" ? document.tagsJson : "[]"
  }));
}
