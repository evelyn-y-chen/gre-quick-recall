const englishWordOrder = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const comparisonWord = (word: string) => word.normalize("NFKC").trim().replace(/\s+/g, " ");

/** Return a display order without changing the source entries, range or IDs.
 * The caller supplies the heading to sort by, such as a pair's core word.
 * Equal spellings, accents and numeric labels retain their source order.
 */
export function alphabeticalIds<T extends { id: string }>(items: T[], getWord: (item: T) => string): string[] {
  return items.map((item, index) => ({ id: item.id, word: comparisonWord(getWord(item)), index }))
    .sort((left, right) => englishWordOrder.compare(left.word, right.word) || left.index - right.index)
    .map((item) => item.id);
}
