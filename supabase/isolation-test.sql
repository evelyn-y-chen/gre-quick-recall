-- Use a disposable/test Supabase project. All test rows are rolled back.
begin;
insert into auth.users(id,aud,role,email) values
 ('00000000-0000-4000-8000-000000000001','authenticated','authenticated','gre-test-a@example.invalid'),
 ('00000000-0000-4000-8000-000000000002','authenticated','authenticated','gre-test-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare result jsonb; begin
 result:=public.save_learning_workspace('{"version":1,"rows":[],"storage":{"note":"A only"}}',0);
 if (result->>'ok') <> 'true' then raise exception 'A insert failed';end if;
 result:=public.save_learning_workspace('{"version":1,"rows":[],"storage":{}}',0);
 if (result->>'conflict') <> 'true' then raise exception 'Stale write accepted';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.learning_workspaces) then raise exception 'B can read A';end if;
 perform public.save_learning_workspace('{"version":1,"rows":[],"storage":{"note":"B only"}}',0);
 if (select count(*) from public.learning_workspaces) <> 1 then raise exception 'B visibility incorrect';end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ begin
 if (select payload->'storage'->>'note' from public.learning_workspaces) <> 'A only' then raise exception 'A overwritten';end if;
end $$;
set local role anon;
do $$ begin
 begin
 perform public.save_learning_workspace('{"version":1,"rows":[],"storage":{}}',0);
 raise exception 'Anonymous save permitted';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
