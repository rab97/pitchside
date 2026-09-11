begin;
select plan(1);

-- `find_members_by_phone(text)` era `security definer`, senza revoca a
-- `public` e senza nessun controllo su chi la chiamasse: con la sola chiave
-- anonima restituiva nome, telefono, email, `notes` (le note interne che la
-- 0004 dichiara «mai esposte al cliente») e i contatori di affidabilità, a
-- chiunque indovinasse un numero.
--
-- L'ha sostituita `claim_members_by_verified_phone()`, che non accetta
-- parametri e legge il numero verificato dal token. Questa asserzione tiene
-- il posto vuoto: se qualcuno la ricreasse — anche solo copiando una vecchia
-- migrazione — il test lo direbbe subito.
select hasnt_function(
  'public', 'find_members_by_phone', array['text'],
  'find_members_by_phone non esiste più: l''anagrafica non si legge per numero'
);

select * from finish();
rollback;
