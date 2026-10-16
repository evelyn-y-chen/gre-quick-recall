-- Username accounts are resolved only by username-auth. No client may read
-- aliases or recovery hashes. Supabase Auth remains the password authority.
create table if not exists public.username_accounts (
  username text primary key check (char_length(username) between 3 and 24 and btrim(username)=username),
  user_id uuid unique references auth.users(id) on delete cascade,
  registration_id uuid not null,
  recovery_hash text not null check (recovery_hash ~ '^[0-9a-f]{64}$'),
  recovery_attempt uuid,
  recovery_locked_until timestamptz,
  created_at timestamptz not null default now()
);
alter table public.username_accounts enable row level security;
revoke all on table public.username_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.username_accounts to service_role;

create table if not exists public.username_auth_limits (
  bucket text primary key check (char_length(bucket) between 1 and 200),
  hit_count integer not null check (hit_count > 0),
  window_started timestamptz not null
);
create index if not exists username_auth_limits_window_idx on public.username_auth_limits(window_started);
alter table public.username_auth_limits enable row level security;
revoke all on table public.username_auth_limits from public, anon, authenticated;
grant select, insert, update, delete on public.username_auth_limits to service_role;

-- A single upsert makes concurrent rate checks atomic. Only keyed hashes of
-- network / username inputs are stored; limit state expires after two days.
create or replace function public.check_username_auth_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_count integer; v_now timestamptz := statement_timestamp();
begin
  if p_bucket is null or char_length(p_bucket) not between 1 and 200
     or p_limit is null or p_limit not between 1 and 1000
     or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    return false;
  end if;
  delete from public.username_auth_limits where window_started < v_now - interval '2 days';
  insert into public.username_auth_limits as limits(bucket, hit_count, window_started)
    values(p_bucket, 1, v_now)
  on conflict(bucket) do update set
    hit_count=case when limits.window_started <= v_now - make_interval(secs=>p_window_seconds)
      then 1 else least(limits.hit_count + 1, p_limit + 1) end,
    window_started=case when limits.window_started <= v_now - make_interval(secs=>p_window_seconds)
      then v_now else limits.window_started end
  returning hit_count into v_count;
  return v_count <= p_limit;
end;
$$;

-- The lease serializes recovery across requests without holding a transaction
-- open while the Auth API is called. A failed request can release its own lease.
create or replace function public.claim_username_recovery(p_username text, p_hash text, p_attempt uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_user uuid;
begin
  if p_attempt is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  update public.username_accounts set recovery_attempt=p_attempt,
    recovery_locked_until=statement_timestamp()+interval '5 minutes'
  where username=p_username and user_id is not null and recovery_hash=p_hash
    and (recovery_locked_until is null or recovery_locked_until <= statement_timestamp())
  returning user_id into v_user;
  return v_user;
end;
$$;

create or replace function public.finish_username_recovery(p_username text, p_attempt uuid, p_hash text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  if p_attempt is null or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  update public.username_accounts set recovery_hash=p_hash,
    recovery_attempt=null, recovery_locked_until=null
  where username=p_username and recovery_attempt=p_attempt;
  return found;
end;
$$;

revoke all on function public.check_username_auth_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.claim_username_recovery(text,text,uuid) from public,anon,authenticated;
revoke all on function public.finish_username_recovery(text,uuid,text) from public,anon,authenticated;
grant execute on function public.check_username_auth_limit(text,integer,integer) to service_role;
grant execute on function public.claim_username_recovery(text,text,uuid) to service_role;
grant execute on function public.finish_username_recovery(text,uuid,text) to service_role;
