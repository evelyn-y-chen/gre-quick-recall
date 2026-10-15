-- Run with a privileged test connection after supabase/feedback.sql.
-- All fixtures and auth users are rolled back; no production feedback is changed.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); owner_id uuid;
 private_id uuid:=gen_random_uuid(); public_id uuid:=gen_random_uuid(); guest_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); guest uuid:=gen_random_uuid(); rows jsonb; rejected boolean;
begin
 select user_id into owner_id from auth.identities where provider='github' and provider_id='293284039' limit 1;
 if owner_id is null then raise exception 'Test requires the configured administrator';end if;
 insert into auth.users(id,aud,role) values(a,'authenticated','authenticated'),(b,'authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.submit_app_feedback(private_id,'Legacy private fixture');
 if (select is_public from public.app_feedback where id=private_id) then raise exception 'Legacy client published private feedback';end if;
 perform public.submit_feedback_v2(public_id,'Public account fixture',true,null);
 -- A retry must not publish an existing private message or alter its body.
 perform public.submit_feedback_v2(private_id,'Changed body',true,null);
 if exists(select 1 from public.app_feedback where id=private_id and (is_public or body<>'Legacy private fixture')) then raise exception 'Retry changed private feedback';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.submit_feedback_v2(other_id,'Other private fixture',false,null);
 rows:=public.list_feedback_v2('mine',0);
 if not rows @> jsonb_build_array(jsonb_build_object('id',other_id)) or rows @> jsonb_build_array(jsonb_build_object('id',private_id)) then raise exception 'Private isolation failed';end if;
 rejected:=false;begin perform public.list_feedback_v2('admin',0);exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Non-admin read admin scope';end if;
 rejected:=false;begin perform public.reply_app_feedback(private_id,'Unauthorized');exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Non-admin replied';end if;
 perform set_config('request.jwt.claim.sub','',true);
 perform public.submit_feedback_v2(guest_id,'Public guest fixture',true,guest);
 perform public.submit_feedback_v2(guest_id,'Retry changed',true,guest);
 if (select count(*) from public.app_feedback where id=guest_id)<>1 or (select body from public.app_feedback where id=guest_id)<>'Public guest fixture' then raise exception 'Guest retry failed';end if;
 rejected:=false;begin perform public.submit_feedback_v2(gen_random_uuid(),'Private guest',false,guest);exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Guest created private feedback';end if;
 rejected:=false;begin perform public.submit_feedback_v2(gen_random_uuid(),'Missing guest key',true,null);exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Guest submitted without key';end if;
 rejected:=false;begin perform public.list_feedback_v2('mine',0);exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Guest read private scope';end if;
 rows:=public.list_feedback_v2('public',0);
 if not rows @> jsonb_build_array(jsonb_build_object('id',public_id)) or not rows @> jsonb_build_array(jsonb_build_object('id',guest_id)) or rows @> jsonb_build_array(jsonb_build_object('id',private_id)) or rows @> jsonb_build_array(jsonb_build_object('id',other_id)) then raise exception 'Public visibility failed';end if;
 if exists(select 1 from jsonb_array_elements(rows) f where f ? 'user_id' or f ? 'guest_key') then raise exception 'Identity fields leaked';end if;
 -- Per-browser guest quota and idempotency at the quota boundary.
 for i in 1..9 loop perform public.submit_feedback_v2(gen_random_uuid(),'Quota fixture',true,guest);end loop;
 rejected:=false;begin perform public.submit_feedback_v2(gen_random_uuid(),'Eleventh',true,guest);exception when program_limit_exceeded then rejected:=true;end;
 if not rejected then raise exception 'Guest quota failed';end if;
 perform public.submit_feedback_v2(guest_id,'Retry at quota',true,guest);
 -- The genuine administrator can reply to both kinds; visibility stays unchanged.
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.reply_app_feedback(public_id,'Public author reply');
 perform public.reply_app_feedback(private_id,'Private author reply');
 rows:=public.list_feedback_v2('admin',0);
 if not rows @> jsonb_build_array(jsonb_build_object('id',private_id,'reply','Private author reply','is_public',false)) then raise exception 'Admin private reply failed';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 rows:=public.list_feedback_v2('mine',0);
 if not rows @> jsonb_build_array(jsonb_build_object('id',private_id,'reply','Private author reply')) then raise exception 'Owner cannot read private reply';end if;
 perform set_config('request.jwt.claim.sub','',true);
 rows:=public.list_feedback_v2('public',0);
 if not rows @> jsonb_build_array(jsonb_build_object('id',public_id,'reply','Public author reply')) or rows @> jsonb_build_array(jsonb_build_object('id',private_id)) then raise exception 'Reply visibility failed';end if;
 if has_table_privilege('anon','public.app_feedback','SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','public.app_feedback','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Direct table permissions exposed';end if;
end;$$;
set local role anon;
do $$ begin
 perform public.submit_feedback_v2(gen_random_uuid(),'Real anonymous role fixture',true,gen_random_uuid());
end;$$;
select jsonb_typeof(public.list_feedback_v2('public',0))='array' as anonymous_public_rpc_ok;
reset role;
do $$ begin
 if has_function_privilege('anon','public.submit_app_feedback(uuid,text)','EXECUTE') or
    has_function_privilege('anon','public.list_app_feedback(boolean,integer)','EXECUTE') or
    has_function_privilege('anon','public.reply_app_feedback(uuid,text)','EXECUTE') then raise exception 'Anonymous legacy/private access granted';end if;
 if not has_function_privilege('anon','public.submit_feedback_v2(uuid,text,boolean,uuid)','EXECUTE') or
    not has_function_privilege('anon','public.list_feedback_v2(text,integer)','EXECUTE') then raise exception 'Anonymous public RPC not granted';end if;
end;$$;
select true as feedback_privacy_and_retries_passed;
rollback;
