create table public.admin_course_images (
 id text primary key check (id ~ '^[A-Za-z0-9._-]{1,160}$'),
 map_id text not null default 'gre-cloze-signals' references public.admin_course_maps(id) on delete cascade,
 mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
 data_base64 text not null check (length(data_base64) between 4 and 600000 and data_base64 ~ '^[A-Za-z0-9+/]+={0,2}$'),
 width integer not null check (width between 1 and 5000),
 height integer not null check (height between 1 and 12000),
 byte_size integer not null check (byte_size between 1 and 450000 and octet_length(decode(data_base64,'base64'))=byte_size),
 updated_at timestamptz not null default now()
);
alter table public.admin_course_images enable row level security;
revoke all on table public.admin_course_images from public, anon, authenticated;
grant select on table public.admin_course_images to authenticated;
create policy admin_course_images_read on public.admin_course_images
 for select to authenticated using ((select public.is_analytics_admin()));
