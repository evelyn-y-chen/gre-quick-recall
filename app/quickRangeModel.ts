export type BBRange = { volume: string; lists: number[] };
type BBEntry = { volume: string; list: number };

function parseRange(raw: string | null): unknown {
  try { return raw === null ? null : JSON.parse(raw); } catch { return null; }
}

export function restoreBBRange(raw: string | null, entries: BBEntry[]): BBRange {
  const fallback = { volume: "全部", lists: [1] };
  const stored = parseRange(raw);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return fallback;
  const { volume, lists } = stored as Partial<BBRange>;
  if (typeof volume !== "string" || (volume !== "全部" && !entries.some(entry => entry.volume === volume)) || !Array.isArray(lists)) return fallback;
  const options = [...new Set(entries.filter(entry => volume === "全部" || entry.volume === volume).map(entry => entry.list))];
  return { volume, lists: options.filter(list => lists.includes(list)) };
}

export function restoreGroupRange(raw: string | null, options: string[]): string[] {
  const stored = parseRange(raw);
  // An empty array is an intentional “全不选”, not a missing preference.
  if (Array.isArray(stored)) return options.filter(option => stored.includes(option));
  return options.slice(0, 1);
}
