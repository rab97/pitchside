-- Le ultime dieci cifre di un numero: i cellulari italiani ne hanno dieci, e
-- il gestore scrive «347 220 15 63» mentre gotrue salva «393472201563».
-- Confrontare le stringhe intere significherebbe non trovare mai niente.
create or replace function public.phone_key(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10), '');
$$;

-- Rivendicazione. Nessun parametro, per costruzione: un parametro sarebbe una
-- stringa mandata dal client, cioè esattamente ciò da cui la verifica protegge.
-- Il numero si legge da auth.users, dove l'ha scritto Supabase dopo il codice.
create or replace function public.claim_members_by_verified_phone()
returns setof public.members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere.' using errcode = 'PS012';
  end if;

  select public.phone_key(u.phone) into v_key
    from auth.users u
   where u.id = auth.uid() and u.phone_confirmed_at is not null;

  if v_key is null then
    raise exception 'Il numero non è ancora verificato.' using errcode = 'PS014';
  end if;

  return query
  update public.members m
     set user_id = auth.uid()
   where m.user_id is null
     and public.phone_key(m.phone) = v_key
     -- Un account ha al massimo una scheda per struttura: senza questo filtro
     -- la rivendicazione violerebbe members_facility_user_uniq e fallirebbe
     -- tutta, invece di collegare quello che può.
     and not exists (
       select 1 from public.members x
       where x.facility_id = m.facility_id and x.user_id = auth.uid()
     )
  returning m.*;
end;
$$;

-- La scheda dell'utente in questa struttura, creandola se non c'è.
-- Serve a chi entra con Google e non ha mai telefonato: senza una scheda non
-- esiste nessun member_id da passare a create_booking.
create or replace function public.ensure_my_member(p_facility uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user auth.users;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere.' using errcode = 'PS012';
  end if;

  select id into v_id from public.members
   where facility_id = p_facility and user_id = auth.uid();
  if found then
    return v_id;
  end if;

  select * into v_user from auth.users where id = auth.uid();

  insert into public.members (facility_id, user_id, name, phone, email)
  values (
    p_facility,
    auth.uid(),
    coalesce(nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''),
             nullif(trim(v_user.raw_user_meta_data->>'name'), ''),
             'Cliente'),
    public.phone_key(v_user.phone),
    v_user.email
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.claim_members_by_verified_phone() to authenticated;
grant execute on function public.ensure_my_member(uuid) to authenticated;
