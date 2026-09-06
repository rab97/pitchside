-- btree_gist serve al vincolo di esclusione di bookings: dentro un indice GiST
-- confronta un uuid con `=` accanto a un tstzrange con `&&`. Senza questa
-- estensione il vincolo non si puo' nemmeno creare.
create extension if not exists btree_gist;

-- pgTAP: i test di dominio e di RLS girano dentro il database.
create extension if not exists pgtap with schema extensions;
