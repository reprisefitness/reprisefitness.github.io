-- Run once in the Supabase SQL Editor for the RepRise project.
-- All app records are private to the signed-in user.

create table if not exists public.reprise_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.reprise_user_data enable row level security;
drop policy if exists "Users manage their RepRise data" on public.reprise_user_data;
create policy "Users manage their RepRise data"
  on public.reprise_user_data
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.reprise_user_data from anon, public;
grant select, insert, update, delete on public.reprise_user_data to authenticated;

create table if not exists public.reprise_photos (
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_id text not null,
  taken_on date not null,
  weight text not null default '',
  note text not null default '',
  file_name text not null default '',
  object_path text not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, photo_id)
);

alter table public.reprise_photos enable row level security;
drop policy if exists "Users manage their RepRise photos" on public.reprise_photos;
create policy "Users manage their RepRise photos"
  on public.reprise_photos
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.reprise_photos from anon, public;
grant select, insert, update, delete on public.reprise_photos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('reprise-photos', 'reprise-photos', false, 5242880)
on conflict (id) do update set public = false, file_size_limit = 5242880;

drop policy if exists "RepRise users read own photos" on storage.objects;
create policy "RepRise users read own photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'reprise-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "RepRise users upload own photos" on storage.objects;
create policy "RepRise users upload own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'reprise-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "RepRise users update own photos" on storage.objects;
create policy "RepRise users update own photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'reprise-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'reprise-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "RepRise users delete own photos" on storage.objects;
create policy "RepRise users delete own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'reprise-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
