-- KrentProcent RM: Supabase schema voor accounts & opgeslagen scans
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
