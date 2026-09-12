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
--
-- Which address wins, and why, decided here while the decision is still cheap.
-- The account's wins. No admin screen writes `members.email` today, but
-- `members_write_admin` is `for all`, so the day the manager's screen gains an
-- email field there will be two writers for one column: an address typed
-- during a phone call, and the one the customer confirmed by opening a link.
-- Only the second is proof that somebody reads that mailbox, and it is the one
-- the customer can correct for themselves. The manager's stays until the
-- customer confirms one, and is replaced on the next call afterwards — which
-- means a manager's screen must say so where it is typed, rather than let an
-- entry disappear silently.
--
-- The refresh is single-facility, and that is a limitation, not an oversight.
-- `p_facility` scopes it to the one card the customer's app is using, while
-- `claim_members_by_verified_phone` deliberately works across all facilities:
-- the two sibling functions disagree about scope. So a customer of two
-- facilities who confirms an address in the first one's app and only ever
-- telephones the second leaves the second's card empty for good. Widening it
-- to `m.user_id = auth.uid()` needs an index on `user_id` first —
-- `members_facility_user_uniq` is `(facility_id, user_id)` and cannot serve a
-- lookup on `user_id` alone — and the cost of that index is worth weighing
-- when the reminder job exists and we know whether it reads the card at all or
-- goes to `auth.users` directly, which would retire the question. It is a
-- decision for the reminders sub-project (spec §2.4), not a wart.
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
  -- L'indirizzo si copia qui e non alla chiamata dopo: il ramo tornava la
  -- scheda adottata con `email` ancora vuota, e il valore arrivava solo
  -- quando `ensure_my_member` veniva richiamata. `ClaimPhoneDialog` invalida
  -- ['my-member'] subito dopo aver rivendicato, ma quella e' una coincidenza
  -- del client: questa funzione deve tornare una scheda gia' giusta.
  -- `coalesce` e non l'assegnazione diretta, per la stessa ragione del
  -- `u.email is not null` del ramo sopra: un account senza indirizzo non
  -- cancella quello che il gestore ha scritto sulla scheda.
  if v_key is not null then
    update public.members m
       set user_id = auth.uid(),
           email = coalesce(v_user.email, m.email)
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
