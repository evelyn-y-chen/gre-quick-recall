export type RuntimeD1PreparedStatement = {
  bind(...values: unknown[]): RuntimeD1PreparedStatement;
  run<T = unknown>(): Promise<T>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};

export type RuntimeD1Database = {
  prepare(query: string): RuntimeD1PreparedStatement;
};

let runtimeDatabase: RuntimeD1Database | undefined;

export function setRuntimeDatabase(database: RuntimeD1Database | undefined) {
  runtimeDatabase = database;
}

export function getRuntimeDatabase() {
  if (!runtimeDatabase) throw new Error("Cloud database binding DB is unavailable.");
  return runtimeDatabase;
}
