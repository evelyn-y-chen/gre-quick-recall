import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../app/listWordNumbers.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
const model = {};
new Function('exports', compiled)(model);
const vocabulary = JSON.parse(fs.readFileSync(new URL('../app/vocabulary.json', import.meta.url), 'utf8'));

test('every built-in List starts at one and follows the original full word order', () => {
  const numbers = model.buildListWordNumbers(vocabulary);
  const counts = new Map();
  for (const word of vocabulary) {
    const position = (counts.get(word.list) ?? 0) + 1;
    counts.set(word.list, position);
    assert.equal(numbers.get(word.id), position, `${word.list}: ${word.word}`);
  }
  assert.equal(counts.size, 28);
  assert.equal(numbers.get('l01-dubious'), 1);
  assert.equal(numbers.get('l01-partisan'), 2);
});

test('search, rating filters and shuffling retain original numbers across Lists', () => {
  const sourceNumbers = model.buildListWordNumbers(vocabulary);
  const selected = vocabulary.filter((word, index) => [1, 2, 28].includes(word.list) && index % 3 === 1).reverse();
  const restoredNumbers = model.buildListWordNumbers(selected, vocabulary);
  for (const word of selected) assert.equal(restoredNumbers.get(word.id), sourceNumbers.get(word.id));
  assert.equal(restoredNumbers.get('l01-partisan'), 2);
});

test('imports preserve explicit positions, count custom Lists independently and omit unlisted words', () => {
  const words = [
    {id: 'custom-a', list: 1, number: 18},
    {id: 'custom-b', list: 2},
    {id: 'custom-c', list: 1},
    {id: 'custom-d', list: 2, number: -3},
    {id: 'custom-e'},
    {id: 'custom-f', list: 0, number: 1},
    {id: 'custom-g', list: 3, number: 1.5},
  ];
  assert.deepEqual([...model.buildListWordNumbers(words, vocabulary)], [
    ['custom-a', 18], ['custom-b', 1], ['custom-c', 2], ['custom-d', 2], ['custom-g', 1],
  ]);
});
