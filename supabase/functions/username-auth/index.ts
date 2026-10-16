import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {createUsernameAuthHandler, type UsernameAuthDependencies} from './core.ts';

// Deploy with verify_jwt=false: registration/login use credentials and link validates its user JWT below.
const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
function dependencies(): UsernameAuthDependencies {
const deadline = Date.now() + 65_000;
const options = {
 auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
 global: {
  fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
   const controller = new AbortController();
   const remaining = Math.min(5_000, deadline - Date.now());
   if (remaining <= 0) throw new Error('Request deadline exceeded');
   const abort = () => controller.abort();
   init?.signal?.addEventListener('abort', abort, {once: true});
   if (init?.signal?.aborted) controller.abort();
   const timer = setTimeout(abort, remaining);
   try {
    const response = await fetch(input, {...init, signal: controller.signal});
    // Include response-body reads in the timeout; Auth and PostgREST responses are small JSON.
    const body = response.status === 204 ? null : await response.arrayBuffer();
    return new Response(body, {status: response.status, statusText: response.statusText, headers: response.headers});
   }
   finally { clearTimeout(timer); init?.signal?.removeEventListener('abort', abort); }
  },
 },
};
const admin = createClient(url, serviceKey, options);
// Each sign-in gets an isolated anon client. The admin client must never adopt a user's session.
const anon = () => createClient(url, anonKey, options);
const check = (error: unknown) => { if (error) throw new Error('Supabase operation failed'); };

const deps: UsernameAuthDependencies = {
 secret: serviceKey,
 store: {
  async reserve(username, registrationId, recoveryHash, userId) {
   const {error} = await admin.from('username_accounts').insert({username, registration_id: registrationId, recovery_hash: recoveryHash, ...(userId ? {user_id: userId} : {})});
   if (error?.code === '23505') return false;
   check(error); return true;
  },
  async bind(username, registrationId, userId) {
   const {data, error} = await admin.from('username_accounts').update({user_id: userId})
    .eq('username', username).eq('registration_id', registrationId).is('user_id', null).select('username').maybeSingle();
   check(error); return !!data;
  },
  async release(username, registrationId) {
   const {error} = await admin.from('username_accounts').delete().eq('username', username).eq('registration_id', registrationId);
   check(error);
  },
  async byUsername(username) {
   const {data, error} = await admin.from('username_accounts').select('user_id').eq('username', username).maybeSingle();
   check(error); return data;
  },
  async byUserId(userId) {
   const {data, error} = await admin.from('username_accounts').select('username,recovery_hash').eq('user_id', userId).maybeSingle();
   check(error); return data;
  },
  async limit(bucket, limit, windowSeconds) {
   const {data, error} = await admin.rpc('check_username_auth_limit', {p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds});
   check(error); return data === true;
  },
  async claimRecovery(username, hash, attempt) {
   const {data, error} = await admin.rpc('claim_username_recovery', {p_username: username, p_hash: hash, p_attempt: attempt});
   check(error); return typeof data === 'string' ? data : null;
  },
  async ownsRecovery(username, attempt) {
   const {data, error} = await admin.from('username_accounts').select('username')
    .eq('username', username).eq('recovery_attempt', attempt)
    .gt('recovery_locked_until', new Date().toISOString()).maybeSingle();
   check(error); return !!data;
  },
  async finishRecovery(username, attempt, hash) {
   const {data, error} = await admin.rpc('finish_username_recovery', {p_username: username, p_attempt: attempt, p_hash: hash});
   check(error); return data === true;
  },
  async rotateRecovery(username, userId, oldHash, newHash) {
   const {data, error} = await admin.from('username_accounts').update({recovery_hash: newHash, recovery_attempt: null, recovery_locked_until: null})
    .eq('username', username).eq('user_id', userId).eq('recovery_hash', oldHash)
    .or(`recovery_locked_until.is.null,recovery_locked_until.lte.${new Date().toISOString()}`)
    .select('username').maybeSingle();
   check(error); return !!data;
  },
 },
 auth: {
  async create(email, password, username) {
   const {data, error} = await admin.auth.admin.createUser({email, password, email_confirm: true, user_metadata: {username}});
   check(error); if (!data.user) throw new Error('Missing created user'); return data.user;
  },
  async getById(userId) {
   const {data, error} = await admin.auth.admin.getUserById(userId);
   check(error); return data.user;
  },
  async getFromToken(token) {
   const {data, error} = await admin.auth.getUser(token);
   if (error) return null; return data.user;
  },
  async setPassword(userId, password) {
   const {error} = await admin.auth.admin.updateUserById(userId, {password});
   check(error);
  },
  async setUsername(userId, username) {
   const {error} = await admin.auth.admin.updateUserById(userId, {user_metadata: {username}});
   check(error);
  },
  async signIn(email, password) {
   const {data, error} = await anon().auth.signInWithPassword({email, password});
   if (error) {
    if (error.status && error.status < 500) return null;
    check(error);
   }
   const session = data.session;
   return session && data.user ? {session: {access_token: session.access_token, refresh_token: session.refresh_token}, userId: data.user.id} : null;
  },
  async signOutGlobal(accessToken) {
   const {error} = await admin.auth.admin.signOut(accessToken, 'global'); return !error;
  },
  async delete(userId) { const {error} = await admin.auth.admin.deleteUser(userId); check(error); },
 },
};
return deps;
}

Deno.serve(request => createUsernameAuthHandler(dependencies())(request));
