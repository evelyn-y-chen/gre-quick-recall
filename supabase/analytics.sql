-- Opt-in, aggregate-only usage analytics. No notes, words, emails, or IPs.
create table if not exists public.usage_daily (
 day date not null,
 actor_key text not null check (length(actor_key)=34),
 event_type text not null check(event_type in ('app_open','study_start','word_review','note_save','practice_complete','slip_export','slip_import','module_open')),
 module text not null check(module in ('all_words','a_plus','bb','glee','reading','cloze','math','mind_map','notebook','other')),
 count integer not null check(count between 1 and 2000),
 primary key(day,actor_key,event_type,module)
);
alter table public.usage_daily enable row level security;
revoke all on public.usage_daily from public,anon,authenticated;
create index if not exists usage_daily_actor_day on public.usage_daily(actor_key,day);

-- This provider identity comes from GitHub, not editable user metadata.
create or replace function public.is_analytics_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.identities where user_id=auth.uid() and provider='github' and provider_id='293284039');
$$;
revoke all on function public.is_analytics_admin() from public,anon;
grant execute on function public.is_analytics_admin() to authenticated;

create table if not exists public.usage_receipts (id uuid primary key,day date not null);
alter table public.usage_receipts enable row level security;
revoke all on public.usage_receipts from public,anon,authenticated;
create index if not exists usage_receipts_day on public.usage_receipts(day);

create or replace function public.record_usage(p_visitor uuid,p_batch uuid,p_event text,p_module text,p_count integer default 1) returns void
language plpgsql security definer set search_path='' as $$
declare today date := (now() at time zone 'Asia/Shanghai')::date; actor text;
begin
 if p_visitor is null or p_batch is null or p_count is null or p_count<1 or p_count>50 or p_event is null or p_module is null or p_event not in ('app_open','study_start','word_review','note_save','practice_complete','slip_export','slip_import','module_open') or p_module not in ('all_words','a_plus','bb','glee','reading','cloze','math','mind_map','notebook','other') then raise exception 'Invalid usage event' using errcode='22023';end if;
 actor:=case when auth.uid() is null then 'g:'||md5(p_visitor::text) else 'u:'||md5(auth.uid()::text) end;
 -- Usage history is retained for long-term project analysis.
 delete from public.usage_receipts where day < today-2;
 insert into public.usage_receipts values(p_batch,today) on conflict do nothing;
 if not found then return;end if;
 insert into public.usage_daily(day,actor_key,event_type,module,count) values(today,actor,p_event,p_module,p_count)
 on conflict(day,actor_key,event_type,module) do update set count=least(2000,public.usage_daily.count+excluded.count);
end;
$$;
revoke all on function public.record_usage(uuid,uuid,text,text,integer) from public;
grant execute on function public.record_usage(uuid,uuid,text,text,integer) to anon,authenticated;

create or replace function public.usage_dashboard(p_days integer default 7) returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date := (now() at time zone 'Asia/Shanghai')::date; span integer; result jsonb;
begin
 if not public.is_analytics_admin() then raise exception 'Administrator access required' using errcode='42501';end if;
 span:=coalesce(p_days,7);if span not in(7,30,90) then raise exception 'Invalid date range' using errcode='22023';end if;
 with daily as (
 select d::date as day,
 (select count(distinct actor_key) from public.usage_daily where day=d::date) as active,
 (select coalesce(sum(count),0) from public.usage_daily where day=d::date and event_type='word_review') as reviews,
 (select count(*) from auth.users where (created_at at time zone 'Asia/Shanghai')::date=d::date) as registrations
 from pg_catalog.generate_series(today-(span-1),today,interval '1 day') d
 ), first_use as (select actor_key,min(day) as first_day from public.usage_daily group by actor_key), cohort as (
 select actor_key,first_day,exists(select 1 from public.usage_daily u where u.actor_key=f.actor_key and u.day=f.first_day+7) as returned from first_use f where first_day between today-30 and today-7
 )
 select jsonb_build_object(
 'updated_at',now(),'days',span,
 'summary',jsonb_build_object(
 'registered_total',(select count(*) from auth.users),
 'active_today',(select count(distinct actor_key) from public.usage_daily where day=today),
 'active_month',(select count(distinct actor_key) from public.usage_daily where day>=date_trunc('month',today)::date),
 'reviews_today',(select coalesce(sum(count),0) from public.usage_daily where day=today and event_type='word_review'),
 'notes_today',(select coalesce(sum(count),0) from public.usage_daily where day=today and event_type='note_save'),
 'slips_today',(select coalesce(sum(count),0) from public.usage_daily where day=today and event_type='slip_export'),
 'retention_eligible',(select count(*) from cohort),'retention_returned',(select count(*) from cohort where returned)),
 'daily',(select coalesce(jsonb_agg(jsonb_build_object('day',day,'active',active,'reviews',reviews,'registrations',registrations) order by day),'[]'::jsonb) from daily),
 'features',(select coalesce(jsonb_agg(jsonb_build_object('module',module,'count',n) order by n desc),'[]'::jsonb) from (select module,sum(count) as n from public.usage_daily where day>=today-(span-1) and event_type in ('word_review','note_save','practice_complete','module_open') group by module) m),
 'participation',(select coalesce(jsonb_agg(jsonb_build_object('event',event_type,'people',n)),'[]'::jsonb) from (select event_type,count(distinct actor_key) as n from public.usage_daily where day=today group by event_type) p)
 ) into result;
 return result;
end;
$$;
revoke all on function public.usage_dashboard(integer) from public,anon;
grant execute on function public.usage_dashboard(integer) to authenticated;
