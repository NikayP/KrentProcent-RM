-- KrentProcent RM: migratie 0002 — gebruikersnaam veilig wijzigen via RPC
-- Voer dit eenmalig uit in de Supabase SQL Editor.

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
