-- Feedback is accessed only through guarded RPCs; no direct table privileges.
-- Legacy two-argument RPCs stay private for older clients.
create table if not exists public.app_feedback (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 3000),
 reply text not null default '' check(char_length(reply)<=5000),
 created_at timestamptz not null default now(),
 replied_at timestamptz
);
create index if not exists app_feedback_user_created on public.app_feedback(user_id,created_at desc);
create index if not exists app_feedback_created on public.app_feedback(created_at desc,id);
alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from public,anon,authenticated;

create or replace function public.submit_app_feedback(p_id uuid,p_body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid();
begin
 if current_user_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if p_id is null or p_body is null or char_length(btrim(p_body)) not between 1 and 3000 then raise exception 'Invalid feedback' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text,0));
 if exists(select 1 from public.app_feedback where id=p_id and user_id=current_user_id) then return p_id;end if;
 if (select count(*) from public.app_feedback where user_id=current_user_id and created_at>now()-interval '24 hours')>=10 then raise exception 'Daily feedback limit reached' using errcode='54000';end if;
 insert into public.app_feedback(id,user_id,body) values(p_id,current_user_id,btrim(p_body));
 return p_id;
end;$$;

create or replace function public.list_app_feedback(p_admin boolean default false,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 if p_admin and not public.is_analytics_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_offset is null or p_offset<0 then raise exception 'Invalid offset' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc,f.id),'[]'::jsonb) into result from (
 select id,body,reply,created_at,replied_at from public.app_feedback where (p_admin or user_id=auth.uid()) order by created_at desc,id limit 30 offset p_offset
 ) f;
 return result;
end;$$;

create or replace function public.reply_app_feedback(p_id uuid,p_reply text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_analytics_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 if p_reply is null or char_length(btrim(p_reply)) not between 1 and 5000 then raise exception 'Invalid reply' using errcode='22023';end if;
 update public.app_feedback set reply=btrim(p_reply),replied_at=now() where id=p_id;
 if not found then raise exception 'Feedback not found' using errcode='P0002';end if;
end;$$;
revoke all on function public.submit_app_feedback(uuid,text),public.list_app_feedback(boolean,integer),public.reply_app_feedback(uuid,text) from public,anon;
grant execute on function public.submit_app_feedback(uuid,text),public.list_app_feedback(boolean,integer),public.reply_app_feedback(uuid,text) to authenticated;


-- Public feedback is opt-in for accounts; existing rows remain private.
alter table public.app_feedback add column if not exists is_public boolean not null default false;
alter table public.app_feedback add column if not exists guest_key uuid;
alter table public.app_feedback alter column user_id drop not null;
do $$ begin
 if not exists(select 1 from pg_catalog.pg_constraint where conrelid='public.app_feedback'::regclass and conname='app_feedback_author_visibility') then
  alter table public.app_feedback add constraint app_feedback_author_visibility check (
   (user_id is not null and guest_key is null) or
   (user_id is null and is_public and guest_key is not null)
  );
 end if;
end;$$;
create index if not exists app_feedback_public_created on public.app_feedback(created_at desc,id) where is_public;
create index if not exists app_feedback_guest_created on public.app_feedback(guest_key,created_at desc) where guest_key is not null;

create or replace function public.submit_feedback_v2(p_id uuid,p_body text,p_public boolean,p_guest_key uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid();
begin
 if p_id is null or p_body is null or p_public is null or char_length(btrim(p_body)) not between 1 and 3000 then
  raise exception 'Invalid feedback' using errcode='22023';
 end if;
 if current_user_id is null and (not p_public or p_guest_key is null) then
  raise exception 'Guests may only submit public feedback' using errcode='42501';
 end if;
 -- A browser key is only a best-effort guest rate limit, never private-data authorization.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  case when current_user_id is not null then current_user_id::text else 'guest:'||p_guest_key::text end,0));
 -- Retrying cannot change content or visibility of an existing message.
 if exists(select 1 from public.app_feedback where id=p_id and
  ((current_user_id is not null and user_id=current_user_id) or
   (current_user_id is null and user_id is null and guest_key=p_guest_key))) then return p_id;end if;
 if (select count(*) from public.app_feedback where created_at>now()-interval '24 hours' and
  ((current_user_id is not null and user_id=current_user_id) or
   (current_user_id is null and user_id is null and guest_key=p_guest_key)))>=10 then
  raise exception 'Daily feedback limit reached' using errcode='54000';
 end if;
 insert into public.app_feedback(id,user_id,body,is_public,guest_key)
 values(p_id,current_user_id,btrim(p_body),p_public,case when current_user_id is null then p_guest_key else null end);
 return p_id;
end;$$;

create or replace function public.list_feedback_v2(p_scope text default 'public',p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; current_user_id uuid:=auth.uid();
begin
 if p_scope is null or p_scope not in ('public','mine','admin') or p_offset is null or p_offset<0 then
  raise exception 'Invalid feedback scope or offset' using errcode='22023';
 end if;
 if p_scope<>'public' and current_user_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if p_scope='admin' and not public.is_analytics_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 -- Deliberately exclude account IDs, guest keys and all profile information.
 select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc,f.id),'[]'::jsonb) into result from (
  select id,body,reply,created_at,replied_at,is_public from public.app_feedback
  where (p_scope='public' and is_public) or (p_scope='mine' and user_id=current_user_id) or p_scope='admin'
  order by created_at desc,id limit 30 offset p_offset
 ) f;
 return result;
end;$$;
revoke all on function public.submit_feedback_v2(uuid,text,boolean,uuid),public.list_feedback_v2(text,integer) from public,anon,authenticated;
grant execute on function public.submit_feedback_v2(uuid,text,boolean,uuid),public.list_feedback_v2(text,integer) to anon,authenticated;
-- Author replies use reply_app_feedback above and retain the parent's visibility.
