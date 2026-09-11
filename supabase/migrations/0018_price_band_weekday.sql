-- Una riga per giorno, invece di un array di giorni.
--
-- Il motivo non e' estetico: `calc_booking_price` sceglie la fascia con
-- `select ... limit 1` senza `order by`, quindi due fasce sovrapposte fanno
-- dipendere il prezzo da quale riga capita per prima. La specifica di fase 1
-- vieta le sovrapposizioni ma niente le impediva. Un vincolo di esclusione
-- confronta i valori di due righe con degli operatori, e per `smallint[]` non
-- esiste una classe di operatori che dica "questi giorni si accavallano con
-- quelli": con un giorno per riga il vincolo si puo' finalmente scrivere.
--
-- La fascia resta un'idea sola nell'interfaccia — si spuntano i giorni e si
-- salva una volta — e diventa piu' righe qui sotto.

-- 1. La colonna nuova, ancora libera di essere nulla mentre si espande.
alter table public.price_bands add column weekday smallint;

-- 2. Il prezzo atteso per ogni (campo, giorno, minuto d'inizio della fascia),
--    letto dal modello vecchio: e' la fotografia su cui la guardia in fondo
--    verifichera' che non si sia perso niente.
--
-- Nota: niente `on commit drop` qui. Le migrazioni Supabase passano per psql,
-- dove le istruzioni fuori da un blocco di transazione esplicito vanno in
-- autocommit — la tabella temporanea sparirebbe alla fine della propria
-- istruzione, e la guardia in fondo confronterebbe con una tabella vuota,
-- passando in silenzio senza provare niente. La si elimina esplicitamente
-- come ultima istruzione della migrazione, dopo che la guardia l'ha usata.
create temp table price_band_probe as
select pb.field_id, d as weekday, pb.starts_min as minute, pb.price_cents
  from public.price_bands pb
  cross join lateral unnest(pb.weekdays) as d;

-- 3. Una riga per ciascun giorno dell'array; le originali restano
--    riconoscibili perche' hanno `weekday` nullo.
insert into public.price_bands
  (facility_id, field_id, weekdays, weekday, starts_min, ends_min, price_cents)
select pb.facility_id, pb.field_id, array[d]::smallint[], d,
       pb.starts_min, pb.ends_min, pb.price_cents
  from public.price_bands pb
  cross join lateral unnest(pb.weekdays) as d;

delete from public.price_bands where weekday is null;

-- 4. Il modello nuovo.
alter table public.price_bands
  alter column weekday set not null,
  add constraint price_bands_weekday_valid check (weekday between 1 and 7),
  drop column weekdays;

-- Se questo fallisce con 23P01, i dati contenevano gia' fasce sovrapposte:
-- vanno sistemate prima, non e' un difetto della migrazione. Era esattamente
-- il caso che nessuno poteva vedere finche' il vincolo non esisteva.
alter table public.price_bands
  add constraint price_bands_no_overlap exclude using gist (
    field_id with =,
    weekday with =,
    int4range(starts_min::int, ends_min::int) with &&
  );

-- 5. La guardia: nessun prezzo si e' mosso, e nessuna riga si e' persa.
--    Vale piu' di un test che gira dopo, perche' una migrazione che perde una
--    fascia non da' errore: fa sparire l'orario, e PS005 rende il campo non
--    prenotabile invece che gratis.
do $$
declare
  v_moved integer;
  v_expected integer;
  v_actual integer;
begin
  -- No "probe is empty" guard here: this project seeds `price_bands` after
  -- all migrations run (see supabase/config.toml, [db.seed]), so on a fresh
  -- `db reset` the table is genuinely empty at this exact point every time —
  -- that is the normal case, not a broken probe. What made the original
  -- `on commit drop` version vacuous was that it *always* produced an empty
  -- probe regardless of the real data, silently hiding a broken check behind
  -- a plausible-looking one; keeping the table alive (no `on commit drop`)
  -- until it is read here is what restores the check's teeth for the case
  -- that matters — applying this migration to a database that already has
  -- price bands in the old shape.
  select count(*) into v_moved
    from price_band_probe p
   where not exists (
     select 1 from public.price_bands pb
      where pb.field_id = p.field_id
        and pb.weekday = p.weekday
        and p.minute >= pb.starts_min
        and p.minute <  pb.ends_min
        and pb.price_cents = p.price_cents
   );
  if v_moved > 0 then
    raise exception 'price band migration changed % price(s)', v_moved;
  end if;

  select count(*) into v_expected from price_band_probe;
  select count(*) into v_actual from public.price_bands;
  if v_expected <> v_actual then
    raise exception 'price band migration expected % rows, got %', v_expected, v_actual;
  end if;
end $$;

drop table price_band_probe;

create index if not exists price_bands_field_day_idx
  on public.price_bands (field_id, weekday);

-- Prezzo di uno slot, sommando i minuti che cadono in ciascuna fascia.
-- L'assenza di fascia significa "fuori orario di apertura": le fasce, per
-- vincolo di prodotto, coprono tutto l'orario in cui si puo' prenotare.
create or replace function public.calc_booking_price(
  p_field_id uuid,
  p_slot tstzrange
) returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  tz constant text := 'Europe/Rome';
  total numeric := 0;
  cur timestamptz;
  fin timestamptz;
  loc timestamp;
  dow smallint;
  cur_min integer;
  b public.price_bands;
  seg_end timestamptz;
  guard integer := 0;
begin
  cur := lower(p_slot);
  fin := upper(p_slot);
  if cur is null or fin is null or cur >= fin then
    raise exception 'intervallo non valido' using errcode = 'PS001';
  end if;

  while cur < fin loop
    guard := guard + 1;
    if guard > 100 then
      raise exception 'calcolo prezzo non terminato: fasce incoerenti'
        using errcode = 'PS001';
    end if;

    loc := cur at time zone tz;
    dow := extract(isodow from loc)::smallint;
    cur_min := extract(hour from loc)::int * 60 + extract(minute from loc)::int;

    select * into b from public.price_bands pb
     where pb.field_id = p_field_id
       and dow = pb.weekday
       and cur_min >= pb.starts_min
       and cur_min <  pb.ends_min
     limit 1;

    if not found then
      raise exception 'nessuna tariffa attiva per le % del %',
        to_char(loc, 'HH24:MI'), to_char(loc, 'DD/MM/YYYY')
        using errcode = 'PS005';
    end if;

    seg_end := least(
      fin,
      (date_trunc('day', loc) + make_interval(mins => b.ends_min)) at time zone tz
    );

    total := total + b.price_cents
             * (extract(epoch from (seg_end - cur)) / 3600.0);
    cur := seg_end;
  end loop;

  return round(total)::integer;
end;
$$;

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
     and pb.weekday = v_weekday;

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
