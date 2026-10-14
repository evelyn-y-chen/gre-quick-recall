import {createClient} from '@supabase/supabase-js';
import publicConfig from './publicCloud.json';
const url=import.meta.env.VITE_SUPABASE_URL||publicConfig.url,key=import.meta.env.VITE_SUPABASE_ANON_KEY||publicConfig.publishableKey;
export const cloud=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}}):null;
export async function readLoginSettings(signal:AbortSignal){const response=await fetch(url+'/auth/v1/settings',{headers:{apikey:key},signal});if(!response.ok)throw Error('无法读取登录配置');return response.json();}

import type {Session} from '@supabase/supabase-js';
import {validSnapshot,type Snapshot} from './database';
// Pin every operation to its captured access token, even if another tab changes accounts.
function scoped(session:Session){return createClient(url,key,{accessToken:async()=>session.access_token});}
export async function readCloudWorkspace(session:Session){const client=scoped(session);const {data,error}=await client.from('learning_workspaces').select('payload,revision').eq('user_id',session.user.id).maybeSingle();if(error)throw Error('云端读取失败，请检查网络后重试。本机记录仍保留。');if(data&&(!validSnapshot(data.payload)||!Number.isSafeInteger(data.revision)))throw Error('云端记录格式不正确，请保留便笺并联系反馈。');return data as {payload:Snapshot;revision:number}|null;}
export async function saveCloudWorkspace(session:Session,payload:Snapshot,expected:number){const {data,error}=await scoped(session).rpc('save_learning_workspace',{p_payload:payload,p_expected_revision:expected});if(error)throw Error('已保存到本机，云端上传失败，请登录或重试同步。');if(!data?.ok)throw Error('其他设备已经更新云端记录。请先导出便笺，再读取云端或核对后上传。');return data.revision as number;}
