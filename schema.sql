-- Run this once in the Supabase SQL Editor for your project.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

alter table public.profiles add column is_admin boolean not null default false;
alter table public.profiles add column is_banned boolean not null default false;

create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if (new.is_admin is distinct from old.is_admin or new.is_banned is distinct from old.is_banned) then
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
      new.is_admin := old.is_admin;
      new.is_banned := old.is_banned;
    end if;
  end if;
  return new;
end;
$$;

create trigger on_profile_update_guard
  before update on public.profiles
  for each row execute procedure public.prevent_self_privilege_escalation();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  body text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  reply_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.threads enable row level security;

create policy "Threads are viewable by everyone"
  on public.threads for select
  using (true);

create policy "Authenticated users can create threads except news"
  on public.threads for insert
  with check (
    auth.uid() = author_id
    and not exists (select 1 from public.profiles where id = auth.uid() and is_banned = true)
    and (
      category <> 'news-announcements'
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and is_admin = true
      )
    )
  );

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  body text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.replies enable row level security;

create policy "Replies are viewable by everyone"
  on public.replies for select
  using (true);

create policy "Authenticated users can create replies"
  on public.replies for insert
  with check (
    auth.uid() = author_id
    and not exists (select 1 from public.profiles where id = auth.uid() and is_banned = true)
  );

create function public.increment_reply_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.threads set reply_count = reply_count + 1 where id = new.thread_id;
  return new;
end;
$$;

create trigger on_reply_created
  after insert on public.replies
  for each row execute procedure public.increment_reply_count();

insert into storage.buckets (id, name, public) values ('thread-images', 'thread-images', true);

create policy "Images are publicly accessible"
on storage.objects for select
using (bucket_id = 'thread-images');

create policy "Authenticated users can upload images"
on storage.objects for insert
with check (bucket_id = 'thread-images' and auth.role() = 'authenticated');

alter table public.threads add column image_url text;
alter table public.replies add column image_url text;
