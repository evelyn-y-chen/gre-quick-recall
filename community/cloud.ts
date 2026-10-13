import {createClient} from '@supabase/supabase-js';
import publicConfig from './publicCloud.json';
const url=import.meta.env.VITE_SUPABASE_URL||publicConfig.url,key=import.meta.env.VITE_SUPABASE_ANON_KEY||publicConfig.publishableKey;
export const cloud=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
