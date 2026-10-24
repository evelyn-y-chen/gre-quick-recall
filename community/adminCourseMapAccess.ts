import {createClient, type Session} from '@supabase/supabase-js';
import publicConfig from './publicCloud.json';
import {parseAdminCourseMap, type AdminCourseMap} from './clozeLogicMapModel';

export type CourseMapAccessCode = 'login' | 'denied' | 'empty' | 'invalid' | 'network';
export class CourseMapAccessError extends Error {
 constructor(public readonly code: CourseMapAccessCode, message: string) {super(message); this.name = 'CourseMapAccessError';}
}
function cancelled(): DOMException {return new DOMException('Request cancelled', 'AbortError');}
function checkSignal(signal: AbortSignal) {if (signal.aborted) throw cancelled();}
function denied(error: {code?: string; status?: number} | null): boolean {
 return error?.code === '42501' || error?.code === 'PGRST301' || error?.status === 401 || error?.status === 403;
}

/**
 * Capture this panel's token. The client never adopts another tab's auth session,
 * stores a session, or caches the private response. RLS is the final authority.
 */
export async function readAdminCourseMap(session: Session | null, signal: AbortSignal): Promise<AdminCourseMap> {
 if (!session?.user?.id || !session.access_token) throw new CourseMapAccessError('login', '请先登录管理员账号。');
 checkSignal(signal);
 const url = import.meta.env.VITE_SUPABASE_URL || publicConfig.url;
 const key = import.meta.env.VITE_SUPABASE_ANON_KEY || publicConfig.publishableKey;
 if (!url || !key) throw new CourseMapAccessError('network', '账号服务暂时不可用，请稍后重试。');
 const token = session.access_token;
 const client = createClient(url, key, {
  accessToken: async () => token,
  auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
  global: {fetch: (input, init) => fetch(input, {...init, cache: 'no-store'})},
 });
 const controller = new AbortController();
 let timedOut = false;
 const abort = () => controller.abort();
 signal.addEventListener('abort', abort, {once: true});
 // One deadline includes permission verification, SDK retries and the content read.
 const timer = setTimeout(() => {timedOut = true; controller.abort();}, 15000);
 let onAborted: (() => void) | undefined;
 const aborted = new Promise<never>((_, reject) => {
  onAborted = () => reject(timedOut
   ? new CourseMapAccessError('network', '读取超时，请检查网络后重试。')
   : cancelled());
  controller.signal.addEventListener('abort', onAborted, {once: true});
 });
 try {
  checkSignal(signal);
  const work = async () => {
   checkSignal(controller.signal);
   const permission = await client.rpc('is_analytics_admin').abortSignal(controller.signal);
   checkSignal(controller.signal);
   if (permission.error) throw new CourseMapAccessError(denied(permission.error) ? 'denied' : 'network', denied(permission.error) ? '此导图仅向管理员开放。' : '暂时无法确认管理员权限，请重试。');
   if (permission.data !== true) throw new CourseMapAccessError('denied', '此导图仅向管理员开放。');
   const response = await client.from('admin_course_maps')
    .select('id,title,content,version,updated_at')
    .eq('id', 'gre-cloze-signals')
    .abortSignal(controller.signal)
    .maybeSingle();
   checkSignal(controller.signal);
   if (response.error) throw new CourseMapAccessError(denied(response.error) ? 'denied' : 'network', denied(response.error) ? '当前账号无权读取这份导图。' : '导图暂时读取失败，请重试。');
   if (!response.data) throw new CourseMapAccessError('empty', '导图还没有上传，请稍后重试。');
   const map = parseAdminCourseMap(response.data);
   if (!map) throw new CourseMapAccessError('invalid', '导图内容格式暂时无法读取，请稍后重试。');
   return map;
  };
  return await Promise.race([work(), aborted]);
 } catch (error) {
  if (signal.aborted) throw cancelled();
  if (timedOut) throw new CourseMapAccessError('network', '读取超时，请检查网络后重试。');
  if (error instanceof CourseMapAccessError || (error instanceof Error && error.name === 'AbortError')) throw error;
  throw new CourseMapAccessError('network', '导图暂时读取失败，请检查网络后重试。');
 } finally {
  clearTimeout(timer);
  signal.removeEventListener('abort', abort);
  if (onAborted) controller.signal.removeEventListener('abort', onAborted);
 }
}
