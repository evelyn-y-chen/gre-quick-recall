-- Course content is seeded privately and never bundled into public assets.
create table if not exists public.admin_course_maps (
 id text primary key,
 title text not null check (length(title) between 1 and 200),
 content jsonb not null check (
  jsonb_typeof(content) = 'object'
  and content->>'schemaVersion' = '1'
  and jsonb_typeof(content->'root') = 'object'
  and octet_length(content::text) <= 200000
 ),
 version integer not null default 1 check (version >= 1),
 updated_at timestamptz not null default now()
);
alter table public.admin_course_maps enable row level security;
revoke all on table public.admin_course_maps from public, anon, authenticated;
grant select on table public.admin_course_maps to authenticated;
create policy admin_course_maps_read on public.admin_course_maps
 for select to authenticated
 using ((select public.is_analytics_admin()));

-- Only administrators may edit content. Versions are managed by the database.
grant update (content) on public.admin_course_maps to authenticated;
create policy admin_course_maps_update on public.admin_course_maps
 for update to authenticated
 using ((select public.is_analytics_admin()))
 with check ((select public.is_analytics_admin()));
create or replace function public.advance_admin_course_map_version()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
 new.version := old.version + 1;
 new.updated_at := pg_catalog.now();
 return new;
end;
$$;
revoke all on function public.advance_admin_course_map_version() from public, anon, authenticated;
create trigger advance_admin_course_map_version
 before update on public.admin_course_maps
 for each row execute function public.advance_admin_course_map_version();
