-- KrentProcent: Supabase schema voor accounts & opgeslagen scans
-- Voer dit eenmalig uit in de Supabase SQL Editor.

-- 1. Gebruikersnamen (uniek, lowercase)
create table public.profiles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,24}$')
);

-- 2. Opgeslagen scans per gebruiker
create table public.user_data (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  drinks       jsonb not null default '[]'::jsonb,
  managed_bars jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  constraint user_data_size check (pg_column_size(drinks) < 2000000)
);

-- 3. Row Level Security: iedere gebruiker ziet/bewerkt alleen zijn eigen rijen
alter table public.profiles  enable row level security;
alter table public.user_data enable row level security;

create policy "read own profile" on public.profiles
  for select using (auth.uid() = user_id);

create policy "own data" on public.user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Bij registratie automatisch profiel + lege datarij aanmaken (atomair)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  clean_username text;
begin
  clean_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  insert into public.profiles (user_id, username)
    values (new.id, clean_username);
  insert into public.user_data (user_id)
    values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Beschikbaarheid gebruikersnaam checken (geeft alleen true/false terug, geen e-mails)
create function public.is_username_available(name text) returns boolean
language sql security definer set search_path = public as $$
  select not exists (
    select 1 from public.profiles where username = lower(trim(name))
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- 6. Eigen account volledig verwijderen zonder extra backend
create function public.delete_own_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- 7. Eigen gebruikersnaam wijzigen met server-side validatie (migratie 0002)
create or replace function public.change_username(new_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  clean text := lower(trim(coalesce(new_name, '')));
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if clean !~ '^[a-z0-9._-]{3,24}$' then
    raise exception 'invalid_username';
  end if;
  update public.profiles set username = clean where user_id = auth.uid();
  if not found then
    raise exception 'profile_not_found';
  end if;
  return clean;
exception
  when unique_violation then
    raise exception 'username_taken';
end $$;

revoke all on function public.change_username(text) from public, anon;
grant execute on function public.change_username(text) to authenticated;

-- 8. Opt-in openbare bars & Discover zoeken (migratie 0003)
create table public.public_bars (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  bar_key    text not null,
  bar_name   text not null check (char_length(bar_name) between 1 and 80),
  city       text check (city is null or char_length(city) <= 60),
  drinks     jsonb not null default '[]'::jsonb
             check (jsonb_typeof(drinks) = 'array' and pg_column_size(drinks) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bar_key)
);

create index public_bars_updated_idx on public.public_bars (updated_at desc);

alter table public.public_bars enable row level security;

create policy "anyone reads public bars" on public.public_bars
  for select using (true);

create policy "owner inserts" on public.public_bars
  for insert with check (auth.uid() = user_id);

create policy "owner updates" on public.public_bars
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "owner deletes" on public.public_bars
  for delete using (auth.uid() = user_id);

create or replace function public.enforce_public_bar_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.public_bars where user_id = new.user_id) >= 50 then
    raise exception 'public_bar_limit';
  end if;
  return new;
end $$;

create trigger public_bars_limit before insert on public.public_bars
  for each row execute function public.enforce_public_bar_limit();

create or replace function public.search_public_bars(q text default '', lim int default 30)
returns table (
  id          uuid,
  username    text,
  bar_name    text,
  city        text,
  drink_count int,
  updated_at  timestamptz
)
language sql stable security definer set search_path = public as $$
  with parsed as (
    select left(trim(coalesce(q, '')), 1) = '@' as is_user,
           replace(replace(replace(lower(ltrim(trim(coalesce(q, '')), '@')),
             '!', '!!'), '%', '!%'), '_', '!_') as term
  )
  select pb.id,
         p.username,
         pb.bar_name,
         pb.city,
         jsonb_array_length(pb.drinks)::int as drink_count,
         pb.updated_at
  from public.public_bars pb
  join public.profiles p on p.user_id = pb.user_id
  cross join parsed
  where parsed.term = ''
     or (parsed.is_user and p.username like parsed.term || '%' escape '!')
     or (not parsed.is_user and (
           pb.bar_name ilike '%' || parsed.term || '%' escape '!'
        or coalesce(pb.city, '') ilike '%' || parsed.term || '%' escape '!'
        or p.username like parsed.term || '%' escape '!'))
  order by pb.updated_at desc
  limit least(greatest(coalesce(lim, 30), 1), 50)
$$;

grant execute on function public.search_public_bars(text, int) to anon, authenticated;
