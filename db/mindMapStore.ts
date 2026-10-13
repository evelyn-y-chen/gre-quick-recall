import { getRuntimeDatabase } from "./runtime";

export type StoredMindMapState = {
  value: string;
  revision: number;
  updatedAt: string;
};

let schemaReady: Promise<void> | null = null;

function database() {
  return getRuntimeDatabase();
}

export function ensureMindMapSchema() {
  if (!schemaReady) {
    schemaReady = database().prepare(`
      CREATE TABLE IF NOT EXISTS mind_map_state (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run().then(() => undefined);
  }
  return schemaReady;
}

export async function readMindMapState(key: string): Promise<StoredMindMapState | null> {
  await ensureMindMapSchema();
  const row = await database()
    .prepare("SELECT value, revision, updated_at AS updatedAt FROM mind_map_state WHERE key = ?")
    .bind(key)
    .first<StoredMindMapState>();
  return row ?? null;
}

export async function writeMindMapState(key: string, value: string): Promise<StoredMindMapState> {
  await ensureMindMapSchema();
  await database()
    .prepare(`
      INSERT INTO mind_map_state (key, value, revision, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        revision = mind_map_state.revision + 1,
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(key, value)
    .run();
  const saved = await readMindMapState(key);
  if (!saved) throw new Error("Saved state could not be read back.");
  return saved;
}
