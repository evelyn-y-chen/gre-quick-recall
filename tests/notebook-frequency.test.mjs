import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

const { notebookFrequencyKey, countNotebookFrequency } = loadTs('app/notebookFrequencyModel.ts');
const batch = (id, words, extra = {}) => ({
  id, source: 'Reading practice', date: '2026-11-02',
  words: words.map((word, index) => ({ id: `word-${index}`, word, meaning: `Meaning ${index}`, note: '', origin: 'Practice' })),
  ...extra,
});
const draft = (collection, revision = 0) => JSON.stringify({ [collection.id]: { batch: collection, revision } });

test('frequency counts collections, not multiple definitions or appearances within one collection', () => {
  const first = batch('first', ['cogent', ' cogent ', 'COGENT', 'lucid']);
  const second = batch('second', ['cogent']);
  assert.deepEqual(countNotebookFrequency([first, second], null), { cogent: 2, lucid: 1 });
  assert.deepEqual(countNotebookFrequency([first, first, second], null), { cogent: 2, lucid: 1 }, 'Repeated batch IDs must never inflate the count');
});

test('frequency matches case, whitespace and equivalent Unicode spelling without merging different words', () => {
  const first = batch('one', ['Ｃｏｇｅｎｔ', 'take\u00a0\u00a0off', 'cafe\u0301', 'résumé', 'write', 'well-being']);
  const second = batch('two', ['cogent', ' TAKE off ', 'café', 'resume', 'writing', 'well being']);
  assert.equal(notebookFrequencyKey('  ＣＯＧＥＮＴ  '), 'cogent');
  assert.deepEqual(countNotebookFrequency([first, second], null), {
    cogent: 2, 'take off': 2, café: 2, résumé: 1, resume: 1,
    write: 1, writing: 1, 'well-being': 1, 'well being': 1,
  });
});

test('editing a draft replaces its saved collection, including removed and renamed words', () => {
  const saved = [batch('editing', ['old', 'stay']), batch('other', ['stay'])];
  const edited = batch('editing', ['new', 'stay']);
  assert.deepEqual(countNotebookFrequency(saved, draft(edited, 4)), { new: 1, stay: 2 });
  assert.deepEqual(countNotebookFrequency(saved, draft(batch('editing', []), 4)), { stay: 1 }, 'An empty draft must suppress its stale saved words');
});

test('new unfinished collections count their nonempty draft words immediately', () => {
  const pending = batch('pending', [' lucid ', '', '   ', 'lucid'], { source: '', date: '' });
  assert.deepEqual(countNotebookFrequency([batch('saved', ['lucid'])], draft(pending)), { lucid: 2 });
  assert.deepEqual(countNotebookFrequency([], draft(pending)), { lucid: 1 });
});

test('malformed or unrelated draft data cannot erase saved counts or create phantom collections', () => {
  const saved = batch('saved', ['cogent']);
  const base = { batch: batch('saved', ['wrong']), revision: 3 };
  const invalid = [
    '{broken', 'null', '[]', 'true',
    JSON.stringify({ saved: null }),
    JSON.stringify({ saved: { ...base, revision: -1 } }),
    JSON.stringify({ saved: { ...base, revision: 0.5 } }),
    JSON.stringify({ saved: { ...base, revision: '3' } }),
    JSON.stringify({ different: base }),
    JSON.stringify({ saved: { ...base, batch: { ...base.batch, words: [{}] } } }),
  ];
  for (const raw of invalid) assert.deepEqual(countNotebookFrequency([saved], raw), { cogent: 1 }, `Unexpected draft accepted: ${raw}`);
  assert.deepEqual(countNotebookFrequency([null, {}, { ...saved, source: '' }, saved], null), { cogent: 1 });
});

test('frequency is a pure workspace-scoped view; recomputation never persists or carries another account count', () => {
  const first = [batch('first', ['cogent'])];
  const pending = draft(batch('second', ['cogent', 'lucid']));
  const before = structuredClone(first);
  assert.deepEqual(countNotebookFrequency(first, pending), { cogent: 2, lucid: 1 });
  assert.deepEqual(first, before, 'Computing a badge must not edit meanings, sources or ratings');
  assert.deepEqual(countNotebookFrequency([], null), {});
  assert.deepEqual(countNotebookFrequency([batch('another-account', ['lucid'])], null), { lucid: 1 });
  assert.deepEqual(countNotebookFrequency(first, pending), { cogent: 2, lucid: 1 });
});

test('words that resemble JavaScript object keys remain ordinary counted words', () => {
  const counts = countNotebookFrequency([batch('one', ['__proto__', 'constructor', 'toString']), batch('two', ['constructor'])], null);
  assert.deepEqual(counts, { ['__proto__']: 1, constructor: 2, tostring: 1 });
  assert.equal(Object.getPrototypeOf(counts), Object.prototype);
});
