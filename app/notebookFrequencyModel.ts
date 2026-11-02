import { validNotebookBatch, type NotebookBatch, type NotebookDraft } from "./notebookModel";

// Match spelling across collections, without guessing lemmas or synonyms.
export const notebookFrequencyKey = (word: string) => word.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

/** Number of collections containing each word, including the current local draft.
 * A word counts once within a collection, even when it has several meanings or
 * sources. A draft replaces that collection's saved version instead of adding
 * another occurrence. This is a read model, not an error or test counter.
 */
export function countNotebookFrequency(batches: unknown[], draftRaw: string | null): Record<string, number> {
  const collections = new Map<string, NotebookBatch>();
  for (const batch of batches) {
    if (validNotebookBatch(batch)) collections.set(batch.id, batch);
  }

  try {
    const drafts: unknown = JSON.parse(draftRaw ?? "{}");
    if (drafts && typeof drafts === "object" && !Array.isArray(drafts)) {
      for (const [id, value] of Object.entries(drafts)) {
        if (!value || typeof value !== "object") continue;
        const draft = value as NotebookDraft;
        if (validNotebookBatch(draft.batch, false) && draft.batch.id === id
          && Number.isInteger(draft.revision) && draft.revision >= 0) {
          collections.set(id, draft.batch);
        }
      }
    }
  } catch { /* A damaged draft must not hide the saved collections. */ }

  const counts = new Map<string, number>();
  for (const batch of collections.values()) {
    const words = new Set(batch.words.map((word) => notebookFrequencyKey(word.word)).filter(Boolean));
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}
