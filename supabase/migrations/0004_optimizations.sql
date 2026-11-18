-- KrentProcent: migratie 0004 — database-indexen, lichte metadata-kolommen & constraints
-- Voer dit eenmalig uit in de Supabase SQL Editor. Idempotent (veilig opnieuw uit te voeren).

-- 1. Trigram extensie voor snelle substring-zoekopdrachten (ILIKE '%term%') in Discover
create extension if not exists pg_trgm;

create index if not exists public_bars_bar_name_trgm_idx
  on public.public_bars using gin (bar_name gin_trgm_ops);

create index if not exists public_bars_city_trgm_idx
  on public.public_bars using gin (city gin_trgm_ops);

create index if not exists profiles_username_prefix_idx
  on public.profiles (username text_pattern_ops);

-- 2. Lichte metadata-kolommen op public_bars zodat queries geen grote drinks-JSONB hoeven te lezen
alter table public.public_bars
  add column if not exists drink_count int generated always as (jsonb_array_length(drinks)) stored;

alter table public.public_bars
  add column if not exists drinks_hash text;

-- 3. Constraints op user_data (gelijkgetrokken met public_bars)
do $$
begin
  alter table public.user_data
    add constraint user_data_drinks_array check (jsonb_typeof(drinks) = 'array');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.user_data
    add constraint user_data_bars_array check (jsonb_typeof(managed_bars) = 'array');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.user_data
    add constraint user_data_bars_size check (pg_column_size(managed_bars) < 50000);
exception when duplicate_object then null;
end $$;

-- 4. Race-condition-vrije 50-bars limiet per gebruiker via transactie-advisory-lock
create or replace function public.enforce_public_bar_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  if (select count(*) from public.public_bars where user_id = new.user_id) >= 50 then
    raise exception 'public_bar_limit';
  end if;
  return new;
end $$;

-- 5. search_public_bars gebruikt nu direct de opgeslagen drink_count kolom (leest geen drinks-JSONB)
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
         pb.drink_count,
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
