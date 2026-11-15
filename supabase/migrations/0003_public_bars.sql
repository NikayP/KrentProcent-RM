-- KrentProcent: migratie 0003 — opt-in openbare bars & Discover zoeken
-- Voer dit eenmalig uit in de Supabase SQL Editor.

create table if not exists public.public_bars (
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

create index if not exists public_bars_updated_idx on public.public_bars (updated_at desc);

alter table public.public_bars enable row level security;

drop policy if exists "anyone reads public bars" on public.public_bars;
create policy "anyone reads public bars" on public.public_bars
  for select using (true);

drop policy if exists "owner inserts" on public.public_bars;
create policy "owner inserts" on public.public_bars
  for insert with check (auth.uid() = user_id);

drop policy if exists "owner updates" on public.public_bars;
create policy "owner updates" on public.public_bars
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner deletes" on public.public_bars;
create policy "owner deletes" on public.public_bars
  for delete using (auth.uid() = user_id);

-- Maximaal 50 openbare bars per gebruiker
create or replace function public.enforce_public_bar_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.public_bars where user_id = new.user_id) >= 50 then
    raise exception 'public_bar_limit';
  end if;
  return new;
end $$;

drop trigger if exists public_bars_limit on public.public_bars;
create trigger public_bars_limit before insert on public.public_bars
  for each row execute function public.enforce_public_bar_limit();

-- Zoeken in Discover: "@jan" = gebruikersnaam-prefix; anders bar/stad/gebruikersnaam. Lege query = recent gedeeld.
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
