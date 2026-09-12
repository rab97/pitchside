-- `ensure_my_member` copied the account's email once, when it created the card.
-- A customer who signs in with the SMS code has no address at that moment and
-- adds one later from the profile screen — and the card stayed empty, so the
-- notification work would look there and find nobody to write to.
--
-- The refresh rides on the existing early return: this function already runs
-- every time a customer uses the app, so the value catches up on their next
-- visit. A trigger on `auth.users` would be instant, but this project has never
-- reached into the auth schema and should not start for a field that can be a
-- few minutes stale (spec §2.4).
--
-- `u.email is not null` matters as much as `is distinct from`: an account with
-- no address must not erase an address the card already holds.
create or replace function public.ensure_my_member(p_facility uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user auth.users;
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere.' using errcode = 'PS012';
  end if;

  select id into v_id from public.members
   where facility_id = p_facility and user_id = auth.uid();
  if found then
    update public.members m
       set email = u.email
      from auth.users u
     where m.id = v_id
       and u.id = auth.uid()
       and u.email is not null
       and m.email is distinct from u.email;
    return v_id;
  end if;

  select * into v_user from auth.users where id = auth.uid();

  -- Solo il numero confermato da Supabase conta: `phone` senza
  -- `phone_confirmed_at` e' una stringa che nessuno ha verificato, e
  -- ereditare una scheda e' ereditarne storico e affidabilita' (spec §2.2).
  if v_user.phone_confirmed_at is not null then
    v_key := public.phone_key(v_user.phone);
  end if;

  -- Adozione. La scheda che il gestore ha creato al telefono, ancora senza
  -- account, con lo stesso numero verificato di chi sta entrando: e' sua.
  -- Prima di inserire, non dopo — inserire per primo e' esattamente cio' che
  -- rompeva entrambi i percorsi.
  if v_key is not null then
    update public.members m
       set user_id = auth.uid()
     where m.facility_id = p_facility
       and m.user_id is null
       and public.phone_key(m.phone) = v_key
    returning m.id into v_id;

    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.members (facility_id, user_id, name, phone, email)
  values (
    p_facility,
    auth.uid(),
    coalesce(nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''),
             nullif(trim(v_user.raw_user_meta_data->>'name'), ''),
             'Cliente'),
    v_key,
    v_user.email
  )
  returning id into v_id;

  return v_id;
end;
$$;
