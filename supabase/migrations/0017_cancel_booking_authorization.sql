-- `cancel_booking` distingueva «non esiste» da «non e' tua».
--
-- Il controllo di autorizzazione arrivava dopo il PS009: chi indovinava un
-- UUID otteneva «Prenotazione non trovata.» per un id inventato e «Non puoi
-- disdire la prenotazione di un altro.» per una prenotazione vera. Cioe' un
-- modo per sapere cosa c'e' nel database senza poterlo leggere.
--
-- Adesso i due casi ricevono la stessa risposta, codice e messaggio: non c'e'
-- niente da dedurre. PS009 resta nella classe degli errori della disdetta
-- (0006) ma non viene piu' sollevato: una prenotazione non si cancella mai,
-- si disdice, quindi l'unico modo di non trovarla e' cercarne una che non
-- esiste — ed e' proprio la domanda a cui non si risponde.
--
-- Il corpo e' quello della 0013 con il solo blocco iniziale riscritto: la
-- migrazione non modifica la precedente, la sostituisce per intero.
create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text default null
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.bookings;
  v_late boolean;
begin
  select * into v_row from public.bookings where id = p_booking_id for update;

  -- Autorizzazione prima di ogni altra risposta, e prima di restituire
  -- alcunche': fino alla 0011 la funzione rispondeva con la riga intera a
  -- chiunque la chiedesse, scavalcando la RLS che gliel'aveva appena negata.
  -- `not found` sta nella stessa condizione di proposito: `is_facility_admin`
  -- e `owns_member` con un argomento nullo tornano false senza eccezione,
  -- quindi la riga inesistente prende la strada del rifiuto.
  if not found
     or (not public.is_facility_admin(v_row.facility_id)
         and not public.owns_member(v_row.member_id)) then
    if auth.uid() is null then
      raise exception 'Devi accedere per disdire.' using errcode = 'PS012';
    end if;
    raise exception 'Non puoi disdire questa prenotazione.'
      using errcode = 'PS013';
  end if;

  if v_row.status <> 'active' then
    raise exception 'La prenotazione è già stata disdetta.' using errcode = 'PS010';
  end if;

  v_late := now() > v_row.cancel_deadline;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = p_reason
   where id = p_booking_id
   returning * into v_row;

  if v_late then
    update public.members set missed_count = missed_count + 1
     where id = v_row.member_id;
  end if;

  return v_row;
end;
$$;
