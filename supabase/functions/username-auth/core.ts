export type AuthUser = {id: string; email?: string};
export type AuthSession = {access_token: string; refresh_token: string};
export type UsernameAuthDependencies = {
 secret: string;
 store: {
  reserve(username: string, registrationId: string, recoveryHash: string, userId?: string): Promise<boolean>;
  bind(username: string, registrationId: string, userId: string): Promise<boolean>;
  release(username: string, registrationId: string): Promise<void>;
  byUsername(username: string): Promise<{user_id: string | null} | null>;
  byUserId(userId: string): Promise<{username: string; recovery_hash: string} | null>;
  limit(bucket: string, limit: number, windowSeconds: number): Promise<boolean>;
  claimRecovery(username: string, hash: string, attempt: string): Promise<string | null>;
  ownsRecovery(username: string, attempt: string): Promise<boolean>;
  finishRecovery(username: string, attempt: string, hash: string): Promise<boolean>;
  rotateRecovery(username: string, userId: string, oldHash: string, newHash: string): Promise<boolean>;
 };
 auth: {
  create(email: string, password: string, username: string): Promise<AuthUser>;
  getById(userId: string): Promise<AuthUser | null>;
  getFromToken(token: string): Promise<AuthUser | null>;
  setPassword(userId: string, password: string): Promise<void>;
  setUsername(userId: string, username: string): Promise<void>;
  signIn(email: string, password: string): Promise<{session: AuthSession; userId: string} | null>;
  signOutGlobal(accessToken: string): Promise<boolean>;
  delete(userId: string): Promise<void>;
 };
};

const ORIGINS = new Set([
 'https://evelyn-y-chen.github.io',
 'http://localhost:5182', 'http://127.0.0.1:5182',
 'http://localhost:5183', 'http://127.0.0.1:5183',
]);
const MAX_BODY = 8_192;
const encoder = new TextEncoder();

class PublicError extends Error {
 constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export function normalizeUsername(value: unknown): string {
 if (typeof value !== 'string') throw new PublicError(400, 'invalid_username', '请填写 3–24 个字的用户名，仅使用文字、数字、下划线或短横线。');
 const normalized = value.normalize('NFKC').trim().toLowerCase();
 const length = [...normalized].length;
 if (length < 3 || length > 24 || !/^[\p{L}\p{N}_-]+$/u.test(normalized)) {
  throw new PublicError(400, 'invalid_username', '用户名需为 3–24 个字，仅使用文字、数字、下划线或短横线。');
 }
 return normalized;
}
function passwordValue(value: unknown): string {
 if (typeof value !== 'string' || encoder.encode(value).length < 10 || encoder.encode(value).length > 72) {
  throw new PublicError(400, 'invalid_password', '密码需为 10–72 个 UTF-8 字节；中文和部分符号会占多个字节。');
 }
 return value;
}
function newRecoveryCode(): string {
 const bytes = crypto.getRandomValues(new Uint8Array(24));
 const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
 return `LEM-${hex.match(/.{8}/g)!.join('-')}`;
}
function normalizeRecoveryCode(value: unknown): string {
 const normalized = typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : '';
 if (!/^LEM[A-F0-9]{48}$/.test(normalized)) throw new PublicError(401, 'invalid_recovery', '用户名或恢复码不正确，或恢复操作正在处理中。');
 return normalized;
}

/** No raw IP, username, password or bearer token is stored in rate-limit buckets. */
async function hmac(secret: string, domain: string, value: string): Promise<string> {
 const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
 const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`lemnota:username-auth:${domain}:v1\0${value}`)));
 return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
 if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
  throw new PublicError(415, 'json_required', '请使用 JSON 提交。');
 }
 const declaredLength = Number(request.headers.get('content-length'));
 if (declaredLength > MAX_BODY) throw new PublicError(413, 'body_too_large', '提交内容过长。');
 if (!request.body) throw new PublicError(400, 'invalid_json', '提交内容不是有效的 JSON。');
 const reader = request.body.getReader();
 const chunks: Uint8Array[] = [];
 let size = 0;
 let timer: ReturnType<typeof setTimeout> | undefined;
 const timeout = new Promise<never>((_, reject) => {
  timer = setTimeout(() => {
   void reader.cancel().catch(() => {});
   reject(new PublicError(408, 'request_timeout', '读取请求超时，请重试。'));
  }, 8_000);
 });
 try {
  while (true) {
   const {done, value} = await Promise.race([reader.read(), timeout]);
   if (done) break;
   size += value.byteLength;
   if (size > MAX_BODY) {
    void reader.cancel().catch(() => {});
    throw new PublicError(413, 'body_too_large', '提交内容过长。');
   }
   chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { throw new PublicError(400, 'invalid_json', '提交内容不是有效的 JSON。'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new PublicError(400, 'invalid_json', '请提交有效的账号信息。');
  return parsed as Record<string, unknown>;
 } finally {
  clearTimeout(timer);
  reader.releaseLock();
 }
}

/** The platform must overwrite its trusted last-hop forwarding header; Origin is never authentication. */
function lastHopIp(request: Request): string {
 const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
 const candidate = forwarded || request.headers.get('cf-connecting-ip')?.trim();
 return candidate && candidate.length <= 64 && /^[a-fA-F0-9:.]+$/.test(candidate) ? candidate : 'unknown';
}

export function createUsernameAuthHandler(deps: UsernameAuthDependencies) {
 return async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  const headers = new Headers({
   'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
   'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff',
  });
  if (origin && ORIGINS.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info');
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {status, headers});
  try {
   if (origin && !ORIGINS.has(origin)) throw new PublicError(403, 'origin_not_allowed', '此网页暂不支持调用账号服务。');
   if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
   if (request.method !== 'POST') {
    headers.set('Allow', 'POST, OPTIONS');
    throw new PublicError(405, 'method_not_allowed', '请使用 POST 提交账号操作。');
   }
   if (!deps.secret) throw new Error('Missing server configuration');
   const body = await readBody(request);
   const action = body.action;
   if (!['register', 'login', 'recover', 'link', 'rotate'].includes(action as string)) throw new PublicError(400, 'invalid_action', '不支持此账号操作。');
   const username = normalizeUsername(body.username);
   const password = passwordValue(body.password);
   const ip = lastHopIp(request);
   const rate = async (scope: string, value: string, limit: number, seconds: number) => {
    const bucket = `${scope}:${await hmac(deps.secret, 'rate', `${scope}\0${value}`)}`;
    if (!await deps.store.limit(bucket, limit, seconds)) {
     headers.set('Retry-After', String(seconds));
     throw new PublicError(429, 'rate_limited', '尝试次数较多，请稍后再试。');
    }
   };
   if (action === 'register') await rate('register-ip', ip, 5, 3_600);
   if (action === 'login') {
    await rate('login-ip', ip, 30, 900);
    await rate('login-name', username, 10, 900);
   }
   if (action === 'recover') {
    await rate('recover-ip', ip, 5, 3_600);
    await rate('recover-name', username, 5, 3_600);
   }
   if (action === 'link') await rate('link-ip', ip, 10, 3_600);
   if (action === 'rotate') {
    await rate('rotate-ip', ip, 10, 3_600);
    await rate('rotate-name', username, 10, 3_600);
   }
   const recoveryHash = async (code: string) => {
    // A 192-bit random code resists offline guessing without tying recovery to a rotating server key.
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(
     `lemnota:username-auth:recovery:v1\0${username}\0${normalizeRecoveryCode(code)}`,
    )));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
   };
   const mustSignIn = async (email: string, expectedUserId: string) => {
    const result = await deps.auth.signIn(email, password);
    if (result?.userId !== expectedUserId || !result.session.access_token || !result.session.refresh_token) {
     throw new PublicError(401, 'invalid_credentials', '用户名或密码不正确。');
    }
    return result.session;
   };
   const verifiedUser = async () => {
    const token = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) throw new PublicError(401, 'sign_in_required', '请先登录，再管理当前账号的登录方式。');
    const user = await deps.auth.getFromToken(token);
    if (!user?.email) throw new PublicError(401, 'sign_in_required', '登录已失效，请重新登录后再设置。');
    return user;
   };
   if (action === 'rotate') {
    const user = await verifiedUser();
    const mapping = await deps.store.byUserId(user.id);
    if (!mapping || mapping.username !== username) throw new PublicError(409, 'username_not_linked', '此用户名不属于当前登录账号，请核对后再试。');
    const session = await mustSignIn(user.email!, user.id);
    const recoveryCode = newRecoveryCode();
    if (!await deps.store.rotateRecovery(username, user.id, mapping.recovery_hash, await recoveryHash(recoveryCode))) {
     throw new PublicError(409, 'recovery_in_progress', '恢复码正在更新或账号恢复中，请稍后再试。');
    }
    return json(200, {username, session, recoveryCode});
   }
   if (action === 'login') {
    const mapping = await deps.store.byUsername(username);
    const user = mapping?.user_id ? await deps.auth.getById(mapping.user_id) : null;
    if (!user?.email) throw new PublicError(401, 'invalid_credentials', '用户名或密码不正确。');
    return json(200, {username, session: await mustSignIn(user.email, mapping!.user_id!)});
   }
   if (action === 'recover') {
    const oldHash = await recoveryHash(String(body.recoveryCode ?? ''));
    const attempt = crypto.randomUUID();
    const userId = await deps.store.claimRecovery(username, oldHash, attempt);
    if (!userId) throw new PublicError(401, 'invalid_recovery', '用户名或恢复码不正确，或恢复操作正在处理中。');
    let finished = false;
    try {
     const user = await deps.auth.getById(userId);
     if (!user?.email) throw new Error('Missing account');
     const recoveryCode = newRecoveryCode();
     const newHash = await recoveryHash(recoveryCode);
     if (!await deps.store.ownsRecovery(username, attempt)) throw new Error('Recovery lease expired');
     await deps.auth.setPassword(userId, password);
     let session = await mustSignIn(user.email, userId);
     // Refresh sessions are revoked where possible; issued access JWTs remain valid until expiry.
     const signedOut = await deps.auth.signOutGlobal(session.access_token);
     if (!signedOut) throw new PublicError(503, 'session_revocation_failed', '密码已更新，但退出旧登录未完成。请保留原恢复码，稍后重试恢复。');
     session = await mustSignIn(user.email, userId);
     finished = await deps.store.finishRecovery(username, attempt, newHash);
     if (!finished) {
      await deps.auth.signOutGlobal(session.access_token).catch(() => false);
      throw new Error('Recovery completion failed');
     }
     return json(200, {username, session, recoveryCode});
    } finally {
     // On failure the old code remains usable; a lost worker is released by the database lease.
     if (!finished) await deps.store.finishRecovery(username, attempt, oldHash).catch(() => false);
    }
   }
   let linkedUser: AuthUser | null = null;
   if (action === 'link') {
    linkedUser = await verifiedUser();
    await rate('link-user', linkedUser.id, 10, 3_600);
    if (await deps.store.byUserId(linkedUser.id)) throw new PublicError(409, 'account_already_linked', '当前账号已设置用户名，请使用已有用户名登录。');
   }
   const registrationId = crypto.randomUUID();
   const recoveryCode = newRecoveryCode();
   const hash = await recoveryHash(recoveryCode);
   // Link reserves the user_id too, so concurrent links cannot change the same Auth password.
   if (!await deps.store.reserve(username, registrationId, hash, linkedUser?.id)) {
    if (linkedUser && await deps.store.byUserId(linkedUser.id)) throw new PublicError(409, 'account_already_linked', '当前账号已设置用户名，请使用已有用户名登录。');
    throw new PublicError(409, 'username_taken', '这个用户名已被使用，请换一个。');
   }
   let createdUser: AuthUser | null = null;
   let success = false;
   try {
    if (linkedUser) await deps.auth.setPassword(linkedUser.id, password);
    else {
     // Confirm only a generated, non-routable internal alias, never a person's actual mailbox.
     createdUser = await deps.auth.create(`${crypto.randomUUID()}@lemnota.invalid`, password, username);
    }
    const user = linkedUser ?? createdUser!;
    if (!user.email || (!linkedUser && !await deps.store.bind(username, registrationId, user.id))) throw new Error('Account binding failed');
    const session = await mustSignIn(user.email, user.id);
    success = true;
    // Display metadata follows the committed, usable mapping. Its failure must not remove that mapping.
    if (linkedUser) await deps.auth.setUsername(user.id, username).catch(() => {});
    return json(linkedUser ? 200 : 201, {username, session, recoveryCode});
   } finally {
    if (!success) {
     if (createdUser) await deps.auth.delete(createdUser.id).catch(() => {});
     await deps.store.release(username, registrationId).catch(() => {});
    }
   }
  } catch (error) {
   if (error instanceof PublicError) return json(error.status, {error: error.message, code: error.code});
   // Do not expose SDK errors: they may contain aliases, request headers or database details.
   return json(503, {error: '账号服务暂时不可用，请稍后重试。', code: 'service_unavailable'});
  }
 };
}
