import { getRuntimeDatabase } from "./runtime";
import type { NotebookBatch, NotebookSummary } from "../app/notebookModel";
const prefix = "vocab-notebook:";

export async function listNotebookBatches(): Promise<NotebookSummary[]> {
  const row = await getRuntimeDatabase().prepare(`SELECT json_group_array(json_object(
    'id', json_extract(value, '$.id'), 'source', json_extract(value, '$.source'),
    'date', json_extract(value, '$.date'), 'count', json_array_length(value, '$.words'), 'revision', revision
  )) AS items FROM mind_map_state WHERE key >= ? AND key < ?`).bind(prefix, "vocab-notebook;").first<{ items: string }>();
  return JSON.parse(row?.items ?? "[]");
}
export async function readNotebookBatch(id: string) {
  const row = await getRuntimeDatabase().prepare("SELECT value, revision FROM mind_map_state WHERE key = ?").bind(prefix + id).first<{value: string; revision: number}>();
  return row ? { batch: JSON.parse(row.value) as NotebookBatch, revision: row.revision } : null;
}
export async function saveNotebookBatch(batch: NotebookBatch, revision: number) {
  // A conditional write prevents a stale device from replacing newer edits.
  if (revision === 0) {
    return getRuntimeDatabase().prepare(`INSERT INTO mind_map_state (key, value, revision, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING RETURNING revision`)
      .bind(prefix + batch.id, JSON.stringify(batch)).first<{revision: number}>();
  }
  return getRuntimeDatabase().prepare(`UPDATE mind_map_state SET value = ?, revision = revision + 1,
    updated_at = CURRENT_TIMESTAMP WHERE key = ? AND revision = ? RETURNING revision`)
    .bind(JSON.stringify(batch), prefix + batch.id, revision).first<{revision: number}>();
}
