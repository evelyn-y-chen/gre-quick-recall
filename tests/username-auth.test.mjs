import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const api = {};
const code = ts.transpileModule(fs.readFileSync('supabase/functions/username-auth/core.ts', 'utf8'), {
 compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
new Function('exports', code)(api);
const password = 'a secure password 123';
const origin = 'https://evelyn-y-chen.github.io';

function fixture() {
 const rows = new Map(), users = new Map(), calls = [], tokens = new Map();
 let serial = 0;
 const deps = {
  secret: 'only-on-server-never-a-public-client-key',
  store: {
   async reserve(username, registrationId, recoveryHash, userId) {
    calls.push(['reserve', username, registrationId, recoveryHash, userId]);
    if (rows.has(username) || (userId && [...rows.values()].some(r => r.user_id === userId))) return false;
    rows.set(username, {username, registration_id: registrationId, recovery_hash: recoveryHash, user_id: userId ?? null}); return true;
   },
   async bind(username, registrationId, userId) {
    calls.push(['bind', username, userId]);
    const row = rows.get(username);
    if (!row || row.registration_id !== registrationId || row.user_id) return false;
    row.user_id = userId; return true;
   },
   async release(username, registrationId) {
    calls.push(['release', username, registrationId]);
    if (rows.get(username)?.registration_id === registrationId) rows.delete(username);
   },
   async byUsername(username) { return rows.get(username) ?? null; },
   async byUserId(userId) { const row = [...rows.values()].find(row => row.user_id === userId); return row ? {...row} : null; },
   async limit(bucket, limit, seconds) { calls.push(['limit', bucket, limit, seconds]); return true; },
   async claimRecovery(username, hash, attempt) {
    calls.push(['claim', username, hash, attempt]);
    const row = rows.get(username);
    if (!row?.user_id || row.recovery_hash !== hash || row.attempt) return null;
    row.attempt = attempt; return row.user_id;
   },
   async ownsRecovery(username, attempt) { calls.push(['lease']); return rows.get(username)?.attempt === attempt; },
   async finishRecovery(username, attempt, hash) {
    calls.push(['finish', username, hash]);
    const row = rows.get(username);
    if (!row || row.attempt !== attempt) return false;
    row.recovery_hash = hash; delete row.attempt; return true;
   },
   async rotateRecovery(username, userId, oldHash, newHash) {
    calls.push(['rotate', username]); const row = rows.get(username);
    if (!row || row.user_id !== userId || row.recovery_hash !== oldHash || (row.attempt && !row.expired)) return false;
    row.recovery_hash = newHash; delete row.attempt; delete row.expired; return true;
   },
  },
  auth: {
   async create(email, pass, username) {
    calls.push(['create', email, username]); const user = {id: crypto.randomUUID(), email, password: pass, username};
    users.set(user.id, user); return user;
   },
   async getById(id) { return users.get(id) ?? null; },
   async getFromToken(token) { calls.push(['verifyBearer']); return tokens.get(token) ?? null; },
   async setPassword(id, pass) {
    calls.push(['setPassword', id]); const user = users.get(id); if (!user) throw new Error('missing user');
    user.password = pass;
   },
   async setUsername(id, username) { calls.push(['setUsername', id]); users.get(id).username = username; },
   async signIn(email, pass) {
    calls.push(['signIn', email]);
    const user = [...users.values()].find(user => user.email === email && user.password === pass);
    if (!user) return null;
    return {session: {access_token: `access-${++serial}`, refresh_token: `refresh-${serial}`}, userId: user.id};
   },
   async signOutGlobal(accessToken) { calls.push(['globalSignOut', accessToken]); return true; },
   async delete(id) { calls.push(['delete', id]); users.delete(id); },
  },
 };
 const handler = api.createUsernameAuthHandler(deps);
 const invoke = async (action, extras = {}, headers = {}) => {
  const response = await handler(new Request('https://example.supabase.co/functions/v1/username-auth', {
   method: 'POST', headers: {'content-type': 'application/json', origin, 'x-forwarded-for': '1.2.3.4, 203.0.113.5', ...headers},
   body: JSON.stringify({action, username: 'Learner', password, ...extras}),
  }));
  return {response, body: await response.json()};
 };
 return {deps, rows, users, calls, tokens, handler, invoke};
}

test('username auth normalizes NFKC and counts Unicode code points; passwords use byte limits', async () => {
 assert.equal(api.normalizeUsername('  ＬＥＡＲＮＥＲ_一  '), 'learner_一');
 assert.equal(api.normalizeUsername('𐐀𐐀𐐀'), '𐐨𐐨𐐨');
 for (const username of ['ab', 'a'.repeat(25), 'user@email.test', 'a b', null]) {
  const result = await fixture().invoke('register', {username}); assert.equal(result.response.status, 400);
 }
 for (const pass of ['123456789', '字'.repeat(25), 'a'.repeat(73)]) {
  const result = await fixture().invoke('register', {password: pass}); assert.equal(result.body.code, 'invalid_password');
 }
 assert.equal((await fixture().invoke('register', {password: '字'.repeat(24)})).response.status, 201);
});

test('native registration creates only a random internal alias and returns recovery code once', async () => {
 const f = fixture(); const {response, body} = await f.invoke('register');
 assert.equal(response.status, 201); assert.equal(body.username, 'learner');
 assert.match(body.recoveryCode, /^LEM-(?:[A-F0-9]{8}-){5}[A-F0-9]{8}$/);
 assert.deepEqual(Object.keys(body.session).sort(), ['access_token', 'refresh_token']);
 const create = f.calls.find(c => c[0] === 'create'); assert.match(create[1], /^[a-f0-9-]{36}@lemnota\.invalid$/);
 assert.ok(!JSON.stringify(body).includes('@lemnota.invalid'));
 const row = f.rows.get('learner'); assert.match(row.recovery_hash, /^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(row).includes(password)); assert.ok(!JSON.stringify(row).includes(body.recoveryCode));
 assert.equal((await f.invoke('login')).body.recoveryCode, undefined);
 assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('duplicates and concurrent registrations cannot overwrite the existing account', async () => {
 const f = fixture(); const results = await Promise.all([f.invoke('register'), f.invoke('register')]);
 assert.deepEqual(results.map(r => r.response.status).sort(), [201, 409]);
 assert.equal(f.calls.filter(c => c[0] === 'create').length, 1); assert.equal(f.users.size, 1);
 const id = f.rows.get('learner').user_id;
 assert.equal((await f.invoke('register', {password: 'another password'})).response.status, 409);
 assert.equal(f.rows.get('learner').user_id, id);
 assert.equal((await f.invoke('login')).response.status, 200);
});

test('registration failures clean only their reservation and newly created Auth user', async () => {
 const f = fixture();
 f.deps.store.bind = async () => false;
 assert.equal((await f.invoke('register')).response.status, 503);
 assert.equal(f.users.size, 0); assert.equal(f.rows.size, 0);
 assert.equal(f.calls.filter(c => c[0] === 'delete').length, 1);
 const existing = fixture(); await existing.invoke('register'); const original = existing.rows.get('learner');
 assert.equal((await existing.invoke('register')).response.status, 409);
 assert.equal(existing.rows.get('learner'), original); assert.equal(existing.calls.filter(c => c[0] === 'delete').length, 0);
});

test('login resolves private mapping and returns identical generic errors for missing or bad credentials', async () => {
 const f = fixture(); await f.invoke('register');
 const wrong = await f.invoke('login', {password: 'not the password'});
 const missing = await f.invoke('login', {username: 'nobody'});
 assert.equal(wrong.response.status, 401); assert.equal(missing.response.status, 401); assert.deepEqual(wrong.body, missing.body);
 assert.equal((await f.invoke('login', {username: ' ＬＥＡＲＮＥＲ '})).response.status, 200);
 const bucketCalls = f.calls.filter(c => c[0] === 'limit' && c[1].startsWith('login-'));
 assert.equal(bucketCalls.length, 6);
 assert.ok(bucketCalls.every(c => !c[1].includes('learner') && !c[1].includes('nobody') && !c[1].includes('203.0.113.5')));
 assert.deepEqual(bucketCalls.slice(0, 2).map(c => c.slice(2)), [[30, 900], [10, 900]]);
});

test('server-side limits fail closed and cannot be bypassed by changing an earlier forwarded address', async () => {
 const f = fixture(); await f.invoke('login');
 const firstBucket = f.calls.find(c => c[0] === 'limit')[1];
 f.calls.length = 0; await f.invoke('login', {}, {'x-forwarded-for': '9.9.9.9, 203.0.113.5'});
 assert.equal(f.calls.find(c => c[0] === 'limit')[1], firstBucket);
 f.deps.store.limit = async () => false;
 assert.equal((await f.invoke('register')).response.status, 429); assert.equal(f.users.size, 0);
 f.deps.store.limit = async () => { throw new Error('secret SQL details'); };
 const failed = await f.invoke('register'); assert.equal(failed.response.status, 503); assert.ok(!JSON.stringify(failed.body).includes('SQL'));
});

test('link requires a verified bearer user and reserves its user ID before changing any password', async () => {
 const f = fixture();
 assert.equal((await f.invoke('link')).body.code, 'sign_in_required');
 assert.equal((await f.invoke('link', {}, {authorization: 'Bearer forged'})).response.status, 401);
 const user = {id: crypto.randomUUID(), email: 'oauth@example.test', password: 'old password 123'};
 f.users.set(user.id, user); f.tokens.set('real-token', user);
 const linked = await f.invoke('link', {}, {authorization: 'Bearer real-token'});
 assert.equal(linked.response.status, 200); assert.equal(f.rows.get('learner').user_id, user.id);
 assert.equal(f.calls.filter(c => c[0] === 'create').length, 0);
 const reserve = f.calls.findIndex(c => c[0] === 'reserve'), update = f.calls.findIndex(c => c[0] === 'setPassword');
 assert.ok(reserve < update); assert.equal(f.calls[reserve][4], user.id);
 assert.ok(f.calls.findIndex(c => c[0] === 'signIn') < f.calls.findIndex(c => c[0] === 'setUsername'));
 assert.equal((await f.invoke('login')).response.status, 200);
 const before = f.calls.filter(c => c[0] === 'setPassword').length;
 assert.equal((await f.invoke('link', {username: 'renamed'}, {authorization: 'Bearer real-token'})).body.code, 'account_already_linked');
 assert.equal(f.calls.filter(c => c[0] === 'setPassword').length, before);
});

test('simultaneous links to different names cannot race to change an existing account password', async () => {
 const f = fixture(); const user = {id: crypto.randomUUID(), email: 'oauth@example.test', password};
 f.users.set(user.id, user); f.tokens.set('real-token', user);
 const result = await Promise.all(['first-name', 'second-name'].map(username => f.invoke('link', {username}, {authorization: 'Bearer real-token'})));
 assert.deepEqual(result.map(r => r.response.status).sort(), [200, 409]);
 assert.equal(f.calls.filter(c => c[0] === 'setPassword').length, 1);
});

test('failed link releases its reservation but never deletes the existing account', async () => {
 const f = fixture(); const user = {id: crypto.randomUUID(), email: 'oauth@example.test', password};
 f.users.set(user.id, user); f.tokens.set('real-token', user);
 f.deps.auth.setPassword = async () => { throw new Error('upstream failure'); };
 assert.equal((await f.invoke('link', {}, {authorization: 'Bearer real-token'})).response.status, 503);
 assert.equal(f.users.size, 1); assert.equal(f.rows.size, 0); assert.equal(f.calls.filter(c => c[0] === 'delete').length, 0);
});

test('link sign-in failure leaves no misleading username metadata; metadata failure preserves a usable mapping', async () => {
 for (const failure of ['signIn', 'setUsername']) {
  const f = fixture(); const user = {id: crypto.randomUUID(), email: 'oauth@example.test', password};
  f.users.set(user.id, user); f.tokens.set('real-token', user);
  if (failure === 'signIn') f.deps.auth.signIn = async () => null;
  else f.deps.auth.setUsername = async () => { throw new Error('metadata unavailable'); };
  const result = await f.invoke('link', {}, {authorization: 'Bearer real-token'});
  assert.equal(user.username, undefined);
  if (failure === 'signIn') {
   assert.equal(result.response.status, 401); assert.equal(f.rows.size, 0);
   assert.equal(f.calls.filter(c => c[0] === 'setUsername').length, 0);
  } else {
   assert.equal(result.response.status, 200); assert.equal(result.body.username, 'learner');
   assert.equal(f.rows.get('learner').user_id, user.id);
   assert.equal((await f.invoke('login')).response.status, 200);
   assert.equal((await f.invoke('rotate', {}, {authorization: 'Bearer real-token'})).response.status, 200);
  }
 }
});

test('recovery validates code, verifies its lease, revokes old refresh sessions and rotates the code', async () => {
 const f = fixture(); const original = (await f.invoke('register')).body; const oldHash = f.rows.get('learner').recovery_hash;
 const bad = await f.invoke('recover', {recoveryCode: original.recoveryCode.replace(/[A-F0-9]/g, '0'), password: 'new password 123'});
 assert.equal(bad.response.status, 401);
 f.calls.length = 0;
 const result = await f.invoke('recover', {recoveryCode: original.recoveryCode.toLowerCase().replaceAll('-', ' '), password: 'new password 123'});
 assert.equal(result.response.status, 200); assert.notEqual(result.body.recoveryCode, original.recoveryCode);
 assert.notEqual(f.rows.get('learner').recovery_hash, oldHash);
 const actions = f.calls.map(c => c[0]);
 assert.ok(actions.indexOf('lease') < actions.indexOf('setPassword'));
 assert.ok(actions.indexOf('globalSignOut') > actions.indexOf('setPassword'));
 assert.equal(actions.filter(a => a === 'signIn').length, 2); assert.equal(actions.at(-1), 'finish');
 assert.equal((await f.invoke('recover', {recoveryCode: original.recoveryCode})).response.status, 401);
 assert.equal((await f.invoke('login', {password: 'new password 123'})).response.status, 200);
});

test('an expired recovery lease cannot change password and failure preserves the original code', async () => {
 const f = fixture(); const original = (await f.invoke('register')).body;
 const oldHash = f.rows.get('learner').recovery_hash;
 f.deps.store.ownsRecovery = async () => false; f.calls.length = 0;
 assert.equal((await f.invoke('recover', {recoveryCode: original.recoveryCode})).response.status, 503);
 assert.equal(f.calls.filter(c => c[0] === 'setPassword').length, 0);
 assert.equal(f.rows.get('learner').recovery_hash, oldHash); assert.equal(f.rows.get('learner').attempt, undefined);
});

test('recovery failures do not report success or replace the usable old recovery hash', async () => {
 for (const failure of ['setPassword', 'signOutGlobal', 'finishRecovery']) {
  const f = fixture(); const original = (await f.invoke('register')).body; const oldHash = f.rows.get('learner').recovery_hash;
  if (failure === 'setPassword') f.deps.auth.setPassword = async () => { throw new Error('failed'); };
  if (failure === 'signOutGlobal') f.deps.auth.signOutGlobal = async () => false;
  if (failure === 'finishRecovery') {
   const finish = f.deps.store.finishRecovery;
   f.deps.store.finishRecovery = async (username, attempt, hash) => hash === oldHash ? finish(username, attempt, hash) : false;
  }
  const result = await f.invoke('recover', {recoveryCode: original.recoveryCode, password: 'new password 123'});
  assert.equal(result.response.status, 503, failure); assert.equal(result.body.session, undefined);
  assert.equal(f.rows.get('learner').recovery_hash, oldHash, failure); assert.equal(f.rows.get('learner').attempt, undefined, failure);
 }
});

test('concurrent recovery requests can consume a code only once', async () => {
 const f = fixture(); const original = (await f.invoke('register')).body;
 const result = await Promise.all([f.invoke('recover', {recoveryCode: original.recoveryCode}), f.invoke('recover', {recoveryCode: original.recoveryCode})]);
 assert.deepEqual(result.map(r => r.response.status).sort(), [200, 401]);
 assert.equal(f.calls.filter(c => c[0] === 'setPassword').length, 1);
});

test('server-key rotation leaves recovery codes usable while rate buckets remain keyed', async () => {
 const f = fixture(); const original = (await f.invoke('register')).body;
 const beforeBucket = f.calls.find(c => c[0] === 'limit')[1];
 f.deps.secret = 'a different server key after legitimate rotation';
 const result = await f.invoke('recover', {recoveryCode: original.recoveryCode});
 assert.equal(result.response.status, 200);
 assert.notEqual(f.calls.find(c => c[0] === 'limit' && c[1].startsWith('recover-'))[1], beforeBucket);
});

test('every sign-in checks the expected Auth user ID before returning tokens', async () => {
 for (const action of ['login', 'register', 'link', 'recover', 'rotate']) {
  const f = fixture(); let recoveryCode;
  if (action === 'login' || action === 'recover' || action === 'rotate') recoveryCode = (await f.invoke('register')).body.recoveryCode;
  if (action === 'rotate') f.tokens.set('real-token', f.users.get(f.rows.get('learner').user_id));
  if (action === 'link') {
   const user = {id: crypto.randomUUID(), email: 'oauth@example.test', password};
   f.users.set(user.id, user); f.tokens.set('real-token', user);
  }
  f.deps.auth.signIn = async () => ({session: {access_token: 'wrong-access', refresh_token: 'wrong-refresh'}, userId: 'another-user'});
  const result = await f.invoke(action, {recoveryCode}, ['link', 'rotate'].includes(action) ? {authorization: 'Bearer real-token'} : {});
  assert.equal(result.response.status, 401, action); assert.equal(result.body.session, undefined, action);
  assert.equal(result.body.code, 'invalid_credentials', action);
 }
});

test('authenticated password-confirmed rotation replaces lost recovery codes without changing account ownership', async () => {
 const f = fixture(); const original = (await f.invoke('register')).body;
 const userId = f.rows.get('learner').user_id; f.tokens.set('real-token', f.users.get(userId));
 const result = await f.invoke('rotate', {}, {authorization: 'Bearer real-token'});
 assert.equal(result.response.status, 200); assert.notEqual(result.body.recoveryCode, original.recoveryCode);
 assert.equal(f.rows.get('learner').user_id, userId);
 assert.equal((await f.invoke('recover', {recoveryCode: original.recoveryCode})).response.status, 401);
 assert.equal((await f.invoke('recover', {recoveryCode: result.body.recoveryCode})).response.status, 200);
 const calls = f.calls.filter(c => c[0] === 'limit' && c[1].startsWith('rotate-'));
 assert.deepEqual(calls.map(c => c.slice(2)), [[10, 3600], [10, 3600]]);
});

test('rotation requires both the correct account token and current password', async () => {
 const f = fixture(); await f.invoke('register');
 const user = f.users.get(f.rows.get('learner').user_id); f.tokens.set('real-token', user);
 const hash = f.rows.get('learner').recovery_hash;
 assert.equal((await f.invoke('rotate')).response.status, 401);
 assert.equal((await f.invoke('rotate', {password: 'wrong password'}, {authorization: 'Bearer real-token'})).response.status, 401);
 assert.equal((await f.invoke('rotate', {username: 'another-user'}, {authorization: 'Bearer real-token'})).response.status, 409);
 f.tokens.set('other-token', {id: crypto.randomUUID(), email: 'other@example.test'});
 assert.equal((await f.invoke('rotate', {}, {authorization: 'Bearer other-token'})).response.status, 409);
 assert.equal(f.rows.get('learner').recovery_hash, hash);
});

test('rotation CAS rejects active recovery and concurrent stale hash updates', {timeout: 10_000}, async () => {
 const f = fixture(); const original = (await f.invoke('register')).body;
 f.tokens.set('real-token', f.users.get(f.rows.get('learner').user_id));
 const row = f.rows.get('learner'); row.attempt = 'another-recovery'; const hash = row.recovery_hash;
 assert.equal((await f.invoke('rotate', {}, {authorization: 'Bearer real-token'})).response.status, 409);
 assert.equal(row.recovery_hash, hash); delete row.attempt;
 // Promise.all starts both requests, but WebCrypto may schedule one complete
 // rotation before the other reads its mapping. Hold both copied snapshots
 // until they have the same old hash, then let the atomic CAS decide the winner.
 const readByUserId = f.deps.store.byUserId;
 let reads = 0, releaseReads;
 const bothRead = new Promise(resolve => { releaseReads = resolve; });
 f.deps.store.byUserId = async userId => {
  const snapshot = await readByUserId(userId);
  assert.equal(snapshot.recovery_hash, hash);
  if (++reads === 2) releaseReads();
  await bothRead;
  return snapshot;
 };
 const result = await Promise.all([f.invoke('rotate', {}, {authorization: 'Bearer real-token'}), f.invoke('rotate', {}, {authorization: 'Bearer real-token'})]);
 assert.equal(reads, 2);
 assert.deepEqual(result.map(r => r.response.status).sort(), [200, 409]);
 assert.equal((await f.invoke('recover', {recoveryCode: original.recoveryCode})).response.status, 401);
});

test('rotation clears an expired recovery lease so its old worker cannot restore the previous hash', async () => {
 const f = fixture(); await f.invoke('register');
 const row = f.rows.get('learner'); const oldHash = row.recovery_hash;
 f.tokens.set('real-token', f.users.get(row.user_id));
 row.attempt = 'expired-worker'; row.expired = true;
 assert.equal((await f.invoke('rotate', {}, {authorization: 'Bearer real-token'})).response.status, 200);
 const rotatedHash = row.recovery_hash;
 assert.equal(await f.deps.store.finishRecovery('learner', 'expired-worker', oldHash), false);
 assert.equal(row.recovery_hash, rotatedHash); assert.notEqual(rotatedHash, oldHash);
});

test('CORS is restrictive, supports explicit local QA and never authenticates link by Origin alone', async () => {
 const f = fixture();
 const preflight = await f.handler(new Request('https://example.test', {method: 'OPTIONS', headers: {origin}}));
 assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
 const forbidden = await f.invoke('register', {}, {origin: 'https://evil.test'});
 assert.equal(forbidden.response.status, 403); assert.equal(forbidden.response.headers.get('access-control-allow-origin'), null);
 assert.equal((await f.invoke('link', {}, {origin: 'http://localhost:5183'})).response.status, 401);
 const cli = await f.handler(new Request('https://example.test', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({action: 'register', username: 'cli-user', password})}));
 assert.equal(cli.status, 201);
});

test('malformed, oversized and unsupported requests stop before touching credentials', async () => {
 const f = fixture();
 const request = (body, headers = {}, method = 'POST') => new Request('https://example.test', {method, headers: {'content-type': 'application/json', origin, ...headers}, ...(method !== 'GET' ? {body} : {})});
 assert.equal((await f.handler(request('', {}, 'GET'))).status, 405);
 assert.equal((await f.handler(request('{}', {'content-type': 'text/plain'}))).status, 415);
 for (const body of ['{bad', 'null', '[]']) assert.equal((await f.handler(request(body))).status, 400);
 assert.equal((await f.handler(request(' '.repeat(8193)))).status, 413);
 assert.equal((await f.invoke('unsupported')).response.status, 400);
 assert.equal(f.calls.length, 0);
});
