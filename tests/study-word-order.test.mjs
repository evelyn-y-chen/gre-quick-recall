import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

const { alphabeticalIds } = loadTs('app/studyWordOrder.ts');
const entries = words => words.map((word, index) => ({ id: `id-${index}`, word }));
const ordered = words => alphabeticalIds(entries(words), item => item.word);

test('alphabetical display order preserves source data, selected range and original List numbering', () => {
  const source = [
    { id: 'list-1-1', word: 'zest', list: 1, position: 1 },
    { id: 'list-1-2', word: 'cogent', list: 1, position: 2 },
    { id: 'list-2-1', word: 'able', list: 2, position: 1 },
    { id: 'list-1-3', word: 'abate', list: 1, position: 3 },
  ];
  source.forEach(Object.freeze); Object.freeze(source);
  const selected = source.filter(item => item.list === 1);
  const originalIds = selected.map(item => item.id);
  Object.freeze(selected);
  assert.deepEqual(alphabeticalIds(selected, item => item.word), ['list-1-3', 'list-1-2', 'list-1-1']);
  assert.deepEqual(selected.map(item => item.id), originalIds);
  assert.deepEqual(source.map(item => [item.id, item.list, item.position]), [
    ['list-1-1', 1, 1], ['list-1-2', 1, 2], ['list-2-1', 2, 1], ['list-1-3', 1, 3],
  ]);
});

test('English alphabetical order ignores case and accents and uses numeric ordering', () => {
  assert.deepEqual(ordered(['word 10', 'Zoo', 'éclair', 'Able', 'word 2', 'eagle']), [
    'id-3', 'id-5', 'id-2', 'id-4', 'id-0', 'id-1',
  ]);
});

test('normalization handles full-width spelling and repeated whitespace without altering the label', () => {
  const items = entries(['  Ａble\u00a0  2 ', 'able 10', 'able 2', 'able 1']);
  const before = structuredClone(items);
  assert.deepEqual(alphabeticalIds(items, item => item.word), ['id-3', 'id-0', 'id-2', 'id-1']);
  assert.deepEqual(items, before);
});

test('equivalent case, accent and numeric labels retain source order as stable ties', () => {
  assert.deepEqual(ordered(['résumé', 'RESUME', 're\u0301sume\u0301', 'resume', 'Word 02', 'word 2', 'word 002']), [
    'id-0', 'id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6',
  ]);
});

test('paired entries sort by the supplied core word while preserving both partners and their IDs', () => {
  const pairs = [
    { id: 'pair-z', core: 'zealous', partner: 'ardent' },
    { id: 'pair-a', core: 'abundant', partner: 'plentiful' },
    { id: 'pair-c', core: 'cogent', partner: 'convincing' },
  ];
  const before = structuredClone(pairs);
  assert.deepEqual(alphabeticalIds(pairs, item => item.core), ['pair-a', 'pair-c', 'pair-z']);
  assert.deepEqual(pairs, before);
});

test('empty and punctuation labels use English collation without dropping entries or guessing words', () => {
  assert.deepEqual(ordered(['write', '  ', 'well-being', 'writing', 'well being', '']), [
    'id-1', 'id-5', 'id-4', 'id-2', 'id-0', 'id-3',
  ]);
  assert.deepEqual(ordered(["can't", 'cant']), ['id-0', 'id-1']);
});

test('every call returns a fresh ID list and retains repeated IDs rather than changing membership', () => {
  const items = [{ id: 'same', word: 'z' }, { id: 'same', word: 'a' }];
  const first = alphabeticalIds(items, item => item.word);
  const second = alphabeticalIds(items, item => item.word);
  assert.deepEqual(first, ['same', 'same']);
  assert.notEqual(first, second);
  first.push('display-only');
  assert.deepEqual(second, ['same', 'same']);
  assert.deepEqual(alphabeticalIds([], item => item.word), []);
});
