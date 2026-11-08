import { getRuntimeDatabase } from "./runtime";
import type { NotebookBatch, NotebookSummary } from "../app/notebookModel";
const prefix = "vocab-notebook:";
const changeListeners = new Set<() => void>();
export function subscribeNotebookChanges(listener: () => void) {
  changeListeners.add(listener);
  return () => { changeListeners.delete(listener); };
}
function notifyNotebookChanges() {
  for (const listener of changeListeners) { try { listener(); } catch {} }
}
/** One local read for the frequency index; no separate stored counter. */
export async function readNotebookFrequencyBatches(): Promise<unknown[]> {
  const row = await getRuntimeDatabase().prepare("SELECT json_group_array(json(value)) AS items FROM mind_map_state WHERE key >= ? AND key < ? AND json_valid(value)")
    .bind(prefix,"vocab-notebook;").first<{items: string}>();
  return JSON.parse(row?.items ?? "[]");
}

export async function listNotebookBatches(): Promise<NotebookSummary[]> {
  const row = await getRuntimeDatabase().prepare(`SELECT json_group_array(json_object(
    'id', json_extract(value, '$.id'), 'source', json_extract(value, '$.source'),
    'date', json_extract(value, '$.date'), 'recallReminder', json_extract(value, '$.recallReminder'), 'count', json_array_length(value, '$.words'), 'revision', revision
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
    const saved = await getRuntimeDatabase().prepare(`INSERT INTO mind_map_state (key, value, revision, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING RETURNING revision`)
      .bind(prefix + batch.id, JSON.stringify(batch)).first<{revision: number}>();
    if (saved) notifyNotebookChanges();
    return saved;
  }
  const saved = await getRuntimeDatabase().prepare(`UPDATE mind_map_state SET value = ?, revision = revision + 1,
    updated_at = CURRENT_TIMESTAMP WHERE key = ? AND revision = ? RETURNING revision`)
    .bind(JSON.stringify(batch), prefix + batch.id, revision).first<{revision: number}>();
  if (saved) notifyNotebookChanges();
  return saved;
}
