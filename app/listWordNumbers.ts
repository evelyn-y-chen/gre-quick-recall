type ListWord = {
  id: string;
  list?: number;
  number?: number;
};

function positiveInteger(value: number | undefined): value is number {
  return Number.isInteger(value) && (value ?? 0) > 0;
}

/** Resolve List positions before any search, rating filter or shuffle is applied. */
export function buildListWordNumbers(words: readonly ListWord[], originalWords: readonly ListWord[] = words): Map<string, number> {
  const originalNumbers = new Map<string, number>();
  const originalCounts = new Map<number, number>();
  for (const word of originalWords) {
    if (!positiveInteger(word.list)) continue;
    const position = (originalCounts.get(word.list) ?? 0) + 1;
    originalCounts.set(word.list, position);
    originalNumbers.set(`${word.list}:${word.id}`, positiveInteger(word.number) ? word.number : position);
  }

  const numbers = new Map<string, number>();
  const importedCounts = new Map<number, number>();
  for (const word of words) {
    if (!positiveInteger(word.list)) continue;
    const position = (importedCounts.get(word.list) ?? 0) + 1;
    importedCounts.set(word.list, position);
    numbers.set(word.id, positiveInteger(word.number)
      ? word.number
      : originalNumbers.get(`${word.list}:${word.id}`) ?? position);
  }
  return numbers;
}
