-- Run once in your own Supabase project's SQL Editor.
create table if not exists public.learning_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null,
 revision bigint not null default 1 check(revision > 0),
 updated_at timestamptz not null default now()
);
alter table public.learning_workspaces enable row level security;
revoke all on public.learning_workspaces from anon, authenticated;
grant select on public.learning_workspaces to authenticated;
drop policy if exists own_workspace on public.learning_workspaces;
create policy own_workspace on public.learning_workspaces for select to authenticated using ((select auth.uid()) = user_id);
-- No caller-supplied user id; writes use the verified session identity.
create or replace function public.save_learning_workspace(p_payload jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); new_revision bigint;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_expected_revision is null or p_expected_revision < 0 or p_payload is null or jsonb_typeof(p_payload) <> 'object' or (p_payload->>'version') is distinct from '1' or jsonb_typeof(p_payload->'rows') is distinct from 'array' or jsonb_typeof(p_payload->'storage') is distinct from 'object' or octet_length(p_payload::text) > 15000000 then raise exception 'Invalid workspace'; end if;
 if p_expected_revision = 0 then
  insert into public.learning_workspaces(user_id,payload) values(uid,p_payload) on conflict(user_id) do nothing returning revision into new_revision;
 else
  update public.learning_workspaces set payload=p_payload,revision=revision+1,updated_at=now() where user_id=uid and revision=p_expected_revision returning revision into new_revision;
 end if;
 if new_revision is null then return jsonb_build_object('ok',false,'conflict',true); end if;
 return jsonb_build_object('ok',true,'revision',new_revision);
end;
$$;
revoke all on function public.save_learning_workspace(jsonb,bigint) from public,anon;
grant execute on function public.save_learning_workspace(jsonb,bigint) to authenticated;
