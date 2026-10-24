import {createClient, type Session} from '@supabase/supabase-js';
import publicConfig from './publicCloud.json';
import {parseAdminCourseMap, parseAdminCourseImage, type AdminCourseMap, type AdminCourseImage} from './clozeLogicMapModel';
export type {AdminCourseImage} from './clozeLogicMapModel';

export type CourseMapAccessCode = 'login' | 'denied' | 'empty' | 'invalid' | 'network' | 'conflict';
export class CourseMapAccessError extends Error {
 constructor(public readonly code: CourseMapAccessCode, message: string) {super(message); this.name = 'CourseMapAccessError';}
}

/** Save only the private content column; the database increments its version. */
export async function saveAdminCourseMap(session: Session | null, input: AdminCourseMap, signal: AbortSignal): Promise<AdminCourseMap> {
 if (!session?.user?.id || !session.access_token) throw new CourseMapAccessError('login','请先登录管理员账号。');
 const map=parseAdminCourseMap(input);
 if(!map || new TextEncoder().encode(JSON.stringify(map.content)).length>185000) throw new CourseMapAccessError('invalid','导图内容格式或长度不符合要求。');
 checkSignal(signal);
 const url=import.meta.env.VITE_SUPABASE_URL || publicConfig.url;
 const key=import.meta.env.VITE_SUPABASE_ANON_KEY || publicConfig.publishableKey;
 if(!url || !key)throw new CourseMapAccessError('network','账号服务暂时不可用，请稍后重试。');
 const token=session.access_token;
 const client=createClient(url,key,{
  accessToken:async()=>token,
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store'})},
 });
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},15000);
 let onAborted:(()=>void)|undefined;
 const aborted=new Promise<never>((_,reject)=>{onAborted=()=>reject(timedOut?new CourseMapAccessError('network','保存超时，请重新读取后核对是否已保存。'):cancelled());controller.signal.addEventListener('abort',onAborted,{once:true});});
 try{
  checkSignal(signal);
  const work=async()=>{
   checkSignal(controller.signal);
   const permission=await client.rpc('is_analytics_admin').abortSignal(controller.signal);
   checkSignal(controller.signal);
   if(permission.error || permission.data!==true)throw new CourseMapAccessError(permission.error&&!denied(permission.error)?'network':'denied',permission.error&&!denied(permission.error)?'暂时无法确认管理员权限，请重试。':'此导图仅向管理员开放。');
   const response=await client.from('admin_course_maps').update({content:map.content})
    .eq('id',map.id).eq('version',map.version)
    .select('id,title,content,version,updated_at').abortSignal(controller.signal).maybeSingle();
   checkSignal(controller.signal);
   if(response.error)throw new CourseMapAccessError(denied(response.error)?'denied':'network',denied(response.error)?'当前账号无权编辑这份导图。':'保存失败，请稍后重试。');
   if(!response.data)throw new CourseMapAccessError('conflict','导图已在其他地方更新。请先重新读取，再编辑保存。');
   const saved=parseAdminCourseMap(response.data);
   if(!saved)throw new CourseMapAccessError('invalid','保存结果暂时无法读取，请重新打开核对。');
   return saved;
  };
  return await Promise.race([work(),aborted]);
 }catch(error){
  if(signal.aborted)throw cancelled();
  if(timedOut)throw new CourseMapAccessError('network','保存超时，请重新读取后核对是否已保存。');
  if(error instanceof CourseMapAccessError || (error instanceof Error&&error.name==='AbortError'))throw error;
  throw new CourseMapAccessError('network','保存失败，请检查网络后重试。');
 }finally{
  clearTimeout(timer);signal.removeEventListener('abort',abort);if(onAborted)controller.signal.removeEventListener('abort',onAborted);
 }
}
function cancelled(): DOMException {return new DOMException('Request cancelled', 'AbortError');}
function checkSignal(signal: AbortSignal) {if (signal.aborted) throw cancelled();}
function denied(error: {code?: string; status?: number} | null): boolean {
 return error?.code === '42501' || error?.code === 'PGRST301' || error?.status === 401 || error?.status === 403;
}

/** Private classroom images are fetched individually, never bundled or persisted. */
export async function readAdminCourseImage(session:Session|null,imageId:string,signal:AbortSignal):Promise<AdminCourseImage>{
 if(!session?.user?.id||!session.access_token)throw new CourseMapAccessError('login','请先登录管理员账号。');
 if(!/^[A-Za-z0-9._-]{1,160}$/.test(imageId))throw new CourseMapAccessError('invalid','课堂截图编号无效。');
 checkSignal(signal);
 const url=import.meta.env.VITE_SUPABASE_URL||publicConfig.url,key=import.meta.env.VITE_SUPABASE_ANON_KEY||publicConfig.publishableKey;
 if(!url||!key)throw new CourseMapAccessError('network','账号服务暂时不可用，请稍后重试。');
 const token=session.access_token;
 const client=createClient(url,key,{accessToken:async()=>token,auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store'})}});
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},15000);let onAborted:(()=>void)|undefined;
 const aborted=new Promise<never>((_,reject)=>{onAborted=()=>reject(timedOut?new CourseMapAccessError('network','截图读取超时，请重试。'):cancelled());controller.signal.addEventListener('abort',onAborted,{once:true});});
 try{
  checkSignal(signal);
  const work=async()=>{
   checkSignal(controller.signal);
   const permission=await client.rpc('is_analytics_admin').abortSignal(controller.signal);checkSignal(controller.signal);
   if(permission.error||permission.data!==true)throw new CourseMapAccessError(permission.error&&!denied(permission.error)?'network':'denied',permission.error&&!denied(permission.error)?'暂时无法确认管理员权限，请重试。':'此课堂截图仅向管理员开放。');
   const response=await client.from('admin_course_images').select('id,mime_type,data_base64,width,height').eq('id',imageId).eq('map_id','gre-cloze-signals').abortSignal(controller.signal).maybeSingle();
   checkSignal(controller.signal);
   if(response.error)throw new CourseMapAccessError(denied(response.error)?'denied':'network',denied(response.error)?'当前账号无权读取课堂截图。':'课堂截图读取失败，请重试。');
   if(!response.data)throw new CourseMapAccessError('empty','这张课堂截图暂未上传。');
   const image=parseAdminCourseImage(response.data);
   if(!image||image.id!==imageId)throw new CourseMapAccessError('invalid','课堂截图格式暂时无法读取。');
   return image;
  };
  return await Promise.race([work(),aborted]);
 }catch(error){
  if(signal.aborted)throw cancelled();if(timedOut)throw new CourseMapAccessError('network','截图读取超时，请重试。');
  if(error instanceof CourseMapAccessError||(error instanceof Error&&error.name==='AbortError'))throw error;
  throw new CourseMapAccessError('network','课堂截图读取失败，请检查网络后重试。');
 }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);if(onAborted)controller.signal.removeEventListener('abort',onAborted);}
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
