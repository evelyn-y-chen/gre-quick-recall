import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const model = {};
const code = ts.transpileModule(fs.readFileSync('community/practiceReviewModel.ts', 'utf8'), {
 compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
new Function('exports', code)(model);
const {readPracticeReviewHistory: read, recordPracticeReview: record, duePracticeIds: due, reviewDay} = model;
const firstDay = '2026-10-15';
const known = new Set(['word', 'bb:0', 'bb:1', 'untested']);
const done = {streak: 1, errors: 0, done: true};

test('practice review starts the next day and follows 1, 2, 4, 7, 15, then 30-day intervals', () => {
 let history = record({}, 'word', true, true, firstDay);
 assert.deepEqual(history.word, {level: 0, due: '2026-10-16', lastDay: firstDay, reviews: 1});
 for (const [day, expectedLevel, next] of [
  ['2026-10-16', 1, '2026-10-18'], ['2026-10-18', 2, '2026-10-22'],
  ['2026-10-22', 3, '2026-10-29'], ['2026-10-29', 4, '2026-11-13'],
  ['2026-11-13', 5, '2026-12-13'], ['2026-12-13', 5, '2027-01-12'],
 ]) {
  assert.deepEqual(due(history, day), ['word']);
  history = record(history, 'word', true, true, day);
  assert.equal(history.word.level, expectedLevel);
  assert.equal(history.word.due, next);
  assert.equal(history.word.lastDay, day);
 }
});

test('every wrong or uncertain result resets even a passed word and same-day retries cannot undo it', () => {
 const mature = {word: {level: 5, due: '2026-12-01', lastDay: '2026-10-01', reviews: 12}};
 const reset = record(mature, 'word', false, false, firstDay);
 assert.deepEqual(reset.word, {level: 0, due: '2026-10-16', lastDay: firstDay, reviews: 13});
 assert.equal(record(reset, 'word', true, false, firstDay), reset);
 assert.equal(record(reset, 'word', true, true, firstDay), reset);
 const failedAgain = record(reset, 'word', false, false, '2026-10-16');
 assert.equal(failedAgain.word.due, '2026-10-17');
 assert.equal(failedAgain.word.level, 0);
});

test('a cross-day retry advances only when passed, then later answers that day do not advance again', () => {
 const failed = record({}, 'word', false, false, firstDay);
 assert.equal(record(failed, 'word', true, false, '2026-10-16'), failed);
 const passed = record(failed, 'word', true, true, '2026-10-16');
 assert.equal(passed.word.level, 1);
 assert.equal(passed.word.due, '2026-10-18');
 assert.equal(passed.word.lastDay, '2026-10-16');
 assert.equal(record(passed, 'word', true, true, '2026-10-16'), passed);
});

test('early correct practice and unfinished questions preserve the schedule', () => {
 const original = {word: {level: 3, due: '2026-10-30', lastDay: '2026-10-23', reviews: 4}};
 assert.equal(record(original, 'word', true, true, '2026-10-24'), original);
 assert.equal(record(original, 'word', true, false, '2026-10-30'), original);
 assert.deepEqual(record({}, 'word', true, false, firstDay), {});
 // A future last-answer date in a backup cannot cause an extra upgrade after clock rollback.
 assert.equal(record(original, 'word', true, true, firstDay), original);
});

test('legacy migration includes only answered known entries and never overwrites a newer schedule', () => {
 const results = {word: done, 'bb:0': {streak: 0, errors: 1, done: false},
  'bb:1': {streak: 1, errors: 1, done: false}, untested: {streak: 0, errors: 0, done: false}, deleted: done};
 const migrated = read(null, results, known, firstDay);
 assert.deepEqual(Object.keys(migrated).sort(), ['bb:0', 'bb:1', 'word']);
 assert.deepEqual(due(migrated, firstDay), ['bb:0', 'bb:1', 'word']);
 const updated = record(migrated, 'word', true, true, firstDay);
 const reopened = read(JSON.stringify(updated), results, known, '2026-10-16');
 assert.deepEqual(reopened.word, updated.word);
 assert.equal(reopened.word.due, '2026-10-17');
 assert.deepEqual(read(null, undefined, known, firstDay), {});
 assert.deepEqual(read(null, {untested: results.untested}, known, firstDay), {});
});

test('invalid backup dates, levels, shapes, counts and unknown entries are discarded', () => {
 const valid = {level: 0, due: '2026-10-16', lastDay: firstDay, reviews: 1};
 const variants = [null, [], {level: -1}, {...valid, level: 6}, {...valid, level: 1.5},
  {...valid, due: '2026-02-30'}, {...valid, due: 'tomorrow'}, {...valid, due: '2026-2-03'},
  {...valid, lastDay: '2026-13-01'}, {...valid, reviews: -1}, {...valid, reviews: 1.2},
  {...valid, reviews: Number.MAX_SAFE_INTEGER + 1}];
 for (const value of variants) assert.deepEqual(read(JSON.stringify({word: value}), undefined, known, firstDay), {});
 for (const saved of ['not json', 'null', '[]', '42', '"hello"']) assert.deepEqual(read(saved, undefined, known, firstDay), {});
 assert.deepEqual(read(JSON.stringify({word: valid, deleted: valid}), undefined, known, firstDay), {word: valid});
 assert.throws(() => record({}, 'word', true, true, '2026-02-30'), RangeError);
 assert.throws(() => due({}, '2026-2-03'), RangeError);
});

test('review days use Beijing midnight across devices and handle leap-day scheduling', () => {
 assert.equal(reviewDay(new Date('2026-10-15T15:59:59Z')), '2026-10-15');
 assert.equal(reviewDay(new Date('2026-10-15T16:00:00Z')), '2026-10-16');
 assert.equal(record({}, 'word', true, true, '2028-02-28').word.due, '2028-02-29');
 assert.equal(record({}, 'word', true, true, '2028-02-29').word.due, '2028-03-01');
});

test('updates do not mutate input and repeated BB spellings keep separate entry schedules', () => {
 const original = Object.freeze({'bb:0': Object.freeze({level: 0, due: firstDay, lastDay: '', reviews: 0})});
 const updated = record(original, 'bb:0', true, true, firstDay);
 const both = record(updated, 'bb:1', false, false, firstDay);
 assert.equal(original['bb:0'].due, firstDay);
 assert.equal(updated['bb:1'], undefined);
 assert.equal(both['bb:0'].due, '2026-10-17');
 assert.equal(both['bb:1'].due, '2026-10-16');
 assert.deepEqual(due(both, '2026-10-16'), ['bb:1']);
 const saved = JSON.stringify(both);
 const restored = read(saved, undefined, known, firstDay);
 restored['bb:0'].level = 5;
 assert.equal(both['bb:0'].level, 1);
});
