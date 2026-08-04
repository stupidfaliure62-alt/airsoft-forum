-- Full schema for the AF forum. Safe to paste this entire file into the
-- Supabase SQL Editor at any time — every statement is idempotent, so it
-- won't error even if some or all of it has already been run.

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists is_banned boolean not null default false;

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- SECURITY DEFINER so a policy on profiles can check admin status without
-- recursively re-triggering RLS on profiles.
create or replace function public.is_admin_user()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin = true);
$$;

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin_user());

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

drop trigger if exists on_profile_update_guard on public.profiles;
create trigger on_profile_update_guard
  before update on public.profiles
  for each row execute procedure public.prevent_self_privilege_escalation();

create or replace function public.handle_new_user()
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- threads
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  body text not null,
  image_url text,
  author_id uuid not null references public.profiles(id) on delete cascade,
  reply_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.threads add column if not exists image_url text;

alter table public.threads enable row level security;

drop policy if exists "Threads are viewable by everyone" on public.threads;
create policy "Threads are viewable by everyone"
  on public.threads for select
  using (true);

drop policy if exists "Authenticated users can create threads" on public.threads;
drop policy if exists "Authenticated users can create threads except news" on public.threads;
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

drop policy if exists "Admins can delete any thread" on public.threads;
create policy "Admins can delete any thread"
  on public.threads for delete
  using (public.is_admin_user());

-- replies
create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  body text not null,
  image_url text,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.replies add column if not exists image_url text;

alter table public.replies enable row level security;

drop policy if exists "Replies are viewable by everyone" on public.replies;
create policy "Replies are viewable by everyone"
  on public.replies for select
  using (true);

drop policy if exists "Authenticated users can create replies" on public.replies;
create policy "Authenticated users can create replies"
  on public.replies for insert
  with check (
    auth.uid() = author_id
    and not exists (select 1 from public.profiles where id = auth.uid() and is_banned = true)
  );

drop policy if exists "Admins can delete any reply" on public.replies;
create policy "Admins can delete any reply"
  on public.replies for delete
  using (public.is_admin_user());

create or replace function public.increment_reply_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.threads set reply_count = reply_count + 1 where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists on_reply_created on public.replies;
create trigger on_reply_created
  after insert on public.replies
  for each row execute procedure public.increment_reply_count();

create or replace function public.decrement_reply_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.threads set reply_count = greatest(reply_count - 1, 0) where id = old.thread_id;
  return old;
end;
$$;

drop trigger if exists on_reply_deleted on public.replies;
create trigger on_reply_deleted
  after delete on public.replies
  for each row execute procedure public.decrement_reply_count();

-- admin applications
create table if not exists public.admin_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  hours_online text not null,
  why_admin text not null,
  experience text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.admin_applications enable row level security;

drop policy if exists "Own application or admins view all" on public.admin_applications;
create policy "Own application or admins view all"
  on public.admin_applications for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Users can submit their own application" on public.admin_applications;
create policy "Users can submit their own application"
  on public.admin_applications for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles
      where id = auth.uid() and (is_banned = true or is_admin = true)
    )
  );

drop policy if exists "Admins can update applications" on public.admin_applications;
create policy "Admins can update applications"
  on public.admin_applications for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- image storage
insert into storage.buckets (id, name, public)
values ('thread-images', 'thread-images', true)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp']
where id = 'thread-images';

drop policy if exists "Images are publicly accessible" on storage.objects;
create policy "Images are publicly accessible"
on storage.objects for select
using (bucket_id = 'thread-images');

drop policy if exists "Authenticated users can upload images" on storage.objects;
create policy "Authenticated users can upload images"
on storage.objects for insert
with check (bucket_id = 'thread-images' and auth.role() = 'authenticated');

-- password reset: look up a username's real email so login/reset can work by
-- username while Supabase Auth operates on email under the hood.
create or replace function public.email_for_username(uname text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select au.email from auth.users au
  join public.profiles p on p.id = au.id
  where lower(p.username) = lower(uname)
  limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;

-- votes + emoji reactions on threads and replies
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('thread','reply')),
  target_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (1,-1)),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);

alter table public.votes enable row level security;

drop policy if exists "Votes are viewable by everyone" on public.votes;
create policy "Votes are viewable by everyone"
  on public.votes for select
  using (true);

drop policy if exists "Users can cast their own votes" on public.votes;
create policy "Users can cast their own votes"
  on public.votes for insert
  with check (
    auth.uid() = user_id
    and not exists (select 1 from public.profiles where id = auth.uid() and is_banned = true)
  );

drop policy if exists "Users can change their own vote" on public.votes;
create policy "Users can change their own vote"
  on public.votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own vote" on public.votes;
create policy "Users can remove their own vote"
  on public.votes for delete
  using (auth.uid() = user_id);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('thread','reply')),
  target_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, user_id, emoji)
);

alter table public.reactions enable row level security;

drop policy if exists "Reactions are viewable by everyone" on public.reactions;
create policy "Reactions are viewable by everyone"
  on public.reactions for select
  using (true);

drop policy if exists "Users can add their own reactions" on public.reactions;
create policy "Users can add their own reactions"
  on public.reactions for insert
  with check (
    auth.uid() = user_id
    and not exists (select 1 from public.profiles where id = auth.uid() and is_banned = true)
  );

drop policy if exists "Users can remove their own reactions" on public.reactions;
create policy "Users can remove their own reactions"
  on public.reactions for delete
  using (auth.uid() = user_id);


-- ============================================================
-- QUICK ACCESS: ban / unban a user by username.
-- Also available in-app now: Members page shows Ban/Unban buttons
-- to any logged-in admin. Use these lines only as a manual fallback.
-- ============================================================
-- update public.profiles set is_banned = true  where username = 'USERNAME_HERE'; -- ban
-- update public.profiles set is_banned = false where username = 'USERNAME_HERE'; -- unban
