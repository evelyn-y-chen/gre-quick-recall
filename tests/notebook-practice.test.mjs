import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

const { buildNotebookPractice, notebookQuizMeaning } = loadTs('app/notebookPracticeModel.ts');
const word = (spelling, meaning, extra = {}) => ({ id: `word-${spelling}`, word: spelling, meaning, note: '', origin: '题干', ...extra });
const batch = (id, words, extra = {}) => ({ id, source: id, date: '2026-11-02', words, ...extra });

test('notebook quiz combines case-equivalent words while retaining every own meaning, note and source', () => {
  const first = batch('first', [word('Cogent', '【全能词】\n释义：有说服力的', { note: '我联想到证据', origin: 'List 01 · 第 2 词' })]);
  const second = batch('second', [word(' cogent ', '令人信服；有力的', { note: '我想到逻辑链', origin: 'Day05 · 第 13 题' })]);
  const before = structuredClone([first, second]);
  const result = buildNotebookPractice([first, second]);
  assert.equal(result.collections, 2);
  assert.equal(result.total, 2); assert.equal(result.duplicates, 1);
  assert.equal(result.terms.length, 1);
  const term = result.terms[0];
  assert.equal(term.word, 'Cogent');
  assert.ok(term.meaning.includes('有说服力的')); assert.ok(term.meaning.includes('令人信服；有力的'));
  assert.ok(!term.meaning.includes('全能词')); assert.ok(!term.meaning.includes('释义：'));
  assert.ok(term.note.includes('我联想到证据')); assert.ok(term.note.includes('我想到逻辑链'));
  assert.ok(term.origin.includes('first')); assert.ok(term.origin.includes('second'));
  assert.ok(term.origin.includes('List 01 · 第 2 词')); assert.ok(term.origin.includes('Day05 · 第 13 题'));
  assert.deepEqual([first, second], before, 'Preparing practice must never rewrite original handwritten meanings or notes');
});

test('provenance-only headings are excluded from answers but real definitions and duplicate line removal remain', () => {
  assert.equal(notebookQuizMeaning('【Day05 第13题】\r\n来源：课堂\n出处: p49\n批注说明：待核\n释义：惊恐的\n惊恐的\n使人害怕的'), '惊恐的；使人害怕的');
  assert.equal(notebookQuizMeaning('【来源】\n来源：讲义\n批注说明：暂无'), '');
});

test('unfinished drafts contribute valid meanings and skip empty words or definitions without inventing answers', () => {
  const pending = batch('pending', [word('', '不应出题'), word('lucid', '清楚的'), word('blank', ''), word('headings', '【来源】\n来源：讲义')], { source: '', date: '' });
  const result = buildNotebookPractice([pending, null, { id: 'broken', words: [{}] }]);
  assert.equal(result.collections, 1); assert.equal(result.total, 3);
  assert.equal(result.missingMeanings, 2); assert.equal(result.duplicates, 0);
  assert.deepEqual(result.terms.map(term => [term.word, term.meaning]), [['lucid', '清楚的']]);
});

test('practice IDs are deterministic for the same collection set regardless of selection order', () => {
  const first = batch('first', [word('Cogent', '有说服力的', { note: '第一条联想', rating: 'familiar' })]);
  const second = batch('second', [word('cogent', '有力的', { note: '第二条联想', rating: 'fuzzy' }), word('lucid', '清楚的')]);
  const forward = buildNotebookPractice([first, second]), repeated = buildNotebookPractice([first, second]), reversed = buildNotebookPractice([second, first]);
  assert.equal(forward.id, repeated.id);
  assert.equal(forward.id, reversed.id, 'Checkbox order must not create another saved test for the same selected collections');
  assert.deepEqual(new Map(forward.terms.map(term => [term.word.toLowerCase(), term.id])), new Map(reversed.terms.map(term => [term.word.toLowerCase(), term.id])));
  assert.notEqual(forward.id, buildNotebookPractice([first]).id, 'Different selections must have separate practice scopes');
});

test('same-word ratings conservatively retain the least mastered explicit rating and leave unmarked terms unmarked', () => {
  const groups = [
    batch('green', [word('cogent', '有力的', { rating: 'familiar' }), word('lucid', '清楚的', { rating: 'familiar' })]),
    batch('yellow', [word('COGENT', '有说服力的', { rating: 'fuzzy' }), word('lucid', '明白的', { rating: 'fuzzy' })]),
    batch('red', [word('cogent', '令人信服的', { rating: 'unknown' }), word('new', '新的')]),
  ];
  const terms = new Map(buildNotebookPractice(groups).terms.map(term => [term.word.toLowerCase(), term]));
  assert.equal(terms.get('cogent').rating, 'unknown');
  assert.equal(terms.get('lucid').rating, 'fuzzy');
  assert.equal(terms.get('new').rating, undefined);
  assert.deepEqual(groups[0].words.map(item => item.rating), ['familiar', 'familiar']);
});

test('repeated batch IDs are one collection and identical meanings or notes never multiply within a merged answer', () => {
  const first = batch('first', [word('cogent', '有力的', { note: '同一条联想' })]);
  const second = batch('second', [word('COGENT', '有力的', { note: '同一条联想' })]);
  const result = buildNotebookPractice([first, first, second]);
  assert.equal(result.collections, 2); assert.equal(result.total, 2);
  assert.equal(result.terms[0].meaning, '有力的');
  assert.equal(result.terms[0].note, '同一条联想');
});
