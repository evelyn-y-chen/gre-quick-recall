import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getRuntimeDatabase } from "./runtime";

export function getDb() {
  return drizzle(getRuntimeDatabase() as Parameters<typeof drizzle>[0], { schema });
}
