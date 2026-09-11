-- Il prezzo per tutte le partenze di una giornata, in una sola chiamata.
--
-- Il cliente sceglie fra campo, giorno e durata prima ancora di aver fatto
-- accesso: mostrargli un prezzo per fascia chiamando `calc_booking_price`
-- una volta per ciascuna (fino a un'ottantina fra tre campi in un giorno)
-- e' troppo traffico per una schermata che deve aprirsi in mezzo secondo.
-- Questa funzione fa un solo giro e chiama `calc_booking_price` internamente:
-- stessa unica verita' sul prezzo, una sola richiesta di rete.
--
-- L'orario apribile del giorno si ricava dalle `price_bands` stesse: per
-- vincolo di prodotto le fasce coprono tutto l'orario in cui si puo'
-- prenotare, quindi la loro unione *e'* l'orario di apertura. Il percorso
-- cliente non dipende piu' da una costante scritta nel codice, e cambia da
-- solo se le fasce cambiano.
create or replace function public.slot_prices(
  p_field_id uuid,
  p_day date,
  p_duration_minutes integer
) returns table (start_min integer, price_cents integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tz constant text := 'Europe/Rome';
  v_slot_minutes integer;
  v_weekday smallint;
  v_open_min integer;
  v_close_min integer;
  v_start integer;
begin
  select fac.slot_minutes into v_slot_minutes
    from public.fields f
    join public.facilities fac on fac.id = f.facility_id
   where f.id = p_field_id;

  if not found then
    raise exception 'Campo non trovato.' using errcode = 'PS002';
  end if;

  v_weekday := extract(isodow from p_day)::smallint;

  -- L'unione delle fasce di quel giorno della settimana: se non ce n'e'
  -- nessuna, il campo e' chiuso quel giorno e non c'e' nessuna partenza.
  select min(pb.starts_min), max(pb.ends_min)
    into v_open_min, v_close_min
    from public.price_bands pb
   where pb.field_id = p_field_id
     and v_weekday = any(pb.weekdays);

  if v_open_min is null then
    return;
  end if;

  v_start := v_open_min;
  while v_start + p_duration_minutes <= v_close_min loop
    begin
      start_min := v_start;
      price_cents := public.calc_booking_price(
        p_field_id,
        tstzrange(
          (p_day + make_interval(mins => v_start)) at time zone tz,
          (p_day + make_interval(mins => v_start + p_duration_minutes)) at time zone tz,
          '[)'
        )
      );
      return next;
    exception when sqlstate 'PS005' then
      -- PS005: un tratto dello slot cade in un buco fra due fasce dello
      -- stesso giorno (l'unione copre l'apertura, non garantisce che sia
      -- continua). Si salta quella partenza, non tutta la giornata.
      --
      -- Solo questo codice si cattura. `calc_booking_price` solleva PS001
      -- anche quando il suo contatore di sicurezza supera le 100 iterazioni,
      -- cioe' quando le price_bands sono configurate in modo incoerente: un
      -- `when others` avrebbe fatto sparire in silenzio quella fascia dalla
      -- lista, facendo sembrare un difetto di configurazione un giorno
      -- normale senza tariffa. Un errore del genere deve propagare, non
      -- essere inghiottito qui.
      null;
    end;
    v_start := v_start + v_slot_minutes;
  end loop;
end;
$$;

-- La disponibilita' si guarda senza account: come `busy_slots` e la lettura
-- di `price_bands`, anche questa e' pubblica.
grant execute on function public.slot_prices(uuid, date, integer) to anon, authenticated;
