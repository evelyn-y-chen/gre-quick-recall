-- Run with a database administrator. All fixture state is rolled back.
begin;
do $$
declare v_bucket text := 'qa:' || gen_random_uuid()::text;
begin
  assert not has_table_privilege('anon','public.username_accounts','select');
  assert not has_table_privilege('authenticated','public.username_accounts','select');
  assert not has_table_privilege('authenticated','public.username_accounts','update');
  assert not has_table_privilege('anon','public.username_auth_limits','select');
  assert not has_function_privilege('anon','public.claim_username_recovery(text,text,uuid)','execute');
  assert not has_function_privilege('authenticated','public.finish_username_recovery(text,uuid,text)','execute');
  assert has_function_privilege('service_role','public.claim_username_recovery(text,text,uuid)','execute');
  assert (select relrowsecurity from pg_class where oid='public.username_accounts'::regclass);
  assert public.check_username_auth_limit(v_bucket,2,60);
  assert public.check_username_auth_limit(v_bucket,2,60);
  assert not public.check_username_auth_limit(v_bucket,2,60);
  assert not public.check_username_auth_limit(v_bucket,0,60);
  assert public.claim_username_recovery('nonexistent-qa-user',repeat('0',64),gen_random_uuid()) is null;
  assert not public.finish_username_recovery('nonexistent-qa-user',gen_random_uuid(),repeat('0',64));
end;
$$;
select 'username privacy and rate checks passed; fixtures rolled back' as result;
rollback;
