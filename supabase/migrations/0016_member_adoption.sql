-- Il ricongiungimento dello storico: chi ha prenotato per anni al telefono
-- ritrova le sue prenotazioni al primo accesso (spec 1B §5.4).
--
-- Non funzionava in nessuno dei due percorsi, e quale dei due difetti
-- capitasse dipendeva solo da come il gestore aveva digitato il numero:
--
--  * numero scritto come lo scrive gotrue («3394128807»): `ensure_my_member`
--    inseriva una seconda scheda e moriva con 23505 su
--    `members_facility_phone_uniq`. Il client non mostrava l'errore da
--    nessuna parte: nessun member_id, «Conferma» disabilitata per sempre.
--  * numero scritto a mano («338 111 22 33»): l'indice non vedeva il
--    conflitto, `ensure_my_member` inseriva una SECONDA scheda per la stessa
--    persona, e da quel momento `claim_members_by_verified_phone()` saltava
--    quella struttura — il suo filtro `not exists` la considera «gia'
--    posseduta». Due righe, storico perso, e nessun avviso.
--
-- La correzione sta in Postgres e non nel client, perche' e' li' che la
-- specifica di progetto §2.5 vuole la logica critica: l'ordine fra
-- `ensure_my_member` e la rivendicazione diventa irrilevante.

-- ---------------------------------------------------------------------------
-- 1. L'indice unico parla la stessa lingua di phone_key.
-- ---------------------------------------------------------------------------
-- `phone_key` (0012) normalizza alle ultime dieci cifre, l'indice era sul
-- `phone` grezzo: «338 111 22 33» e «3381112233» convivevano nella stessa
-- struttura, ed erano la stessa persona. Con l'indice allineato l'adozione
-- qui sotto ha sempre al massimo una scheda candidata per struttura.
-- `phone_key` e' `immutable`, quindi si puo' indicizzare.
drop index if exists public.members_facility_phone_uniq;
create unique index members_facility_phone_uniq
  on public.members (facility_id, public.phone_key(phone))
  where phone is not null;

-- ---------------------------------------------------------------------------
-- 2. ensure_my_member adotta prima di inserire.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. La rivendicazione sa cedere il posto al segnaposto che ha creato lei.
-- ---------------------------------------------------------------------------
-- Chi entra con Google non ha un numero al primo accesso: `ensure_my_member`
-- gli crea una scheda vuota molto prima che il dialogo del telefono abbia
-- avuto la sua occasione. Quando poi il numero arriva verificato, quella
-- scheda vuota bloccherebbe l'adozione della scheda storica nella stessa
-- struttura, perche' un account ha al massimo una scheda per struttura
-- (`members_facility_user_uniq`).
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

  -- Il segnaposto cede il posto alla scheda storica. Non e' una fusione —
  -- quella resta fuori perimetro: qui non c'e' niente da fondere, la riga
  -- non ha ne' numero, ne' prenotazioni, ne' ricorrenze. Le due `not exists`
  -- lo verificano prima di cancellare, e non solo per prudenza: entrambe le
  -- chiavi esterne sono `on delete restrict`.
  delete from public.members own
   where own.user_id = auth.uid()
     and own.phone is null
     and not exists (select 1 from public.bookings b where b.member_id = own.id)
     and not exists (select 1 from public.recurrences r where r.member_id = own.id)
     and exists (
       select 1 from public.members h
        where h.facility_id = own.facility_id
          and h.user_id is null
          and public.phone_key(h.phone) = v_key
     );

  return query
  update public.members m
     set user_id = auth.uid()
   where m.user_id is null
     and public.phone_key(m.phone) = v_key
     -- Un account ha al massimo una scheda per struttura: senza questo filtro
     -- la rivendicazione violerebbe members_facility_user_uniq e fallirebbe
     -- tutta, invece di collegare quello che può. Dopo la delete qui sopra
     -- resta vero solo per le strutture dove la scheda dell'account ha una
     -- storia sua, e in quel caso fondere le due non è compito di questa fase.
     and not exists (
       select 1 from public.members x
       where x.facility_id = m.facility_id and x.user_id = auth.uid()
     )
  returning m.*;

  -- Il numero verificato serve anche al gestore, per richiamare (spec §2.2):
  -- una scheda nata dall'accesso con Google non ne ha nessuno. Si scrive solo
  -- dove non c'e' ancora, e solo se in quella struttura nessun'altra scheda
  -- porta lo stesso numero — altrimenti si violerebbe l'indice unico.
  update public.members m
     set phone = v_key
   where m.user_id = auth.uid()
     and m.phone is null
     and not exists (
       select 1 from public.members y
        where y.facility_id = m.facility_id
          and y.id <> m.id
          and public.phone_key(y.phone) = v_key
     );
end;
$$;
