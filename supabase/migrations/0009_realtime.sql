-- La griglia del gestore deve mostrare una prenotazione fatta dall'app mentre
-- lui e' al telefono. Senza questa pubblicazione il canale non riceve nulla.
-- Le righe che passano dal canale rispettano comunque la RLS di bookings.
alter publication supabase_realtime add table public.bookings;
