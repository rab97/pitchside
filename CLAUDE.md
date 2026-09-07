# Pitchside

Prenotazione campi da calcio, multi-struttura. Primo cliente: Palacalcetto, Alba.

`pitchside` è il nome del progetto: repository, `package.json` e `project_id` di
Supabase. Il nome che vede l'utente arriva dai dati della struttura, non da qui.

## Documenti
- Specifica: `docs/superpowers/specs/2026-09-05-prenota-campi-design.md`
- Piano fase 1A: `docs/superpowers/plans/2026-09-05-fase-1a-prenotazioni.md`
- Mockup: `docs/mockups/` — due file HTML autonomi, aprili nel browser

## Regole che non si violano
- Ogni tabella di dominio ha `facility_id`. Nessuna query attraversa le strutture.
- `members.user_id` è nullable: cliente, giocatore e utente sono la stessa tabella.
- Le statistiche puntano a `member_id`, mai a `user_id`.
- Denaro in centesimi (`integer`). Orari delle fasce in minuti da mezzanotte (0..1440).
- Ogni istante è `timestamptz`. Fuso di riferimento `Europe/Rome`, dalla costante in `src/lib/tz.ts`.
- Creazione, spostamento e disdetta prenotazione passano **solo** dalle funzioni RPC.
  Nessuna `insert`/`update` diretta su `bookings` dal client.
- RLS attiva su ogni tabella, nella stessa migrazione che la crea.
- Le squadre nascono solo da un'iscrizione a un torneo (fase 2).

## Comandi
- `npm run dev` — frontend
- `npm run db:start` / `npm run db:stop` — stack Supabase locale (Docker)
- `npm run db:reset` — ricrea il database locale e applica seed
- `npm run test:db` — test pgTAP (regole di dominio e RLS)
- `npm run test` — test unitari
- `npm run types` — rigenera i tipi dopo ogni migrazione

## Convenzioni
- Identificatori in inglese, testo utente e messaggi d'errore in italiano.
- Un file, una responsabilità.
- Le query non stanno nei componenti: stanno in `hooks/`, un gancio per file,
  con il nome che inizia per `use`.
- Import: `@/...` quando si attraversa il confine di una feature o si va in
  `shared/`; relativi solo dentro la stessa cartella. Un `../../../shared/lib/tz`
  è illeggibile e si rompe al primo spostamento.

## Struttura di `src/`
```
features/<area>/            admin · booking (cliente) · auth
  components/               ciò che si disegna
  hooks/                    ciò che interroga il database
  utils/                    logica pura, provabile senza database né React
shared/
  components/ui/            componenti usati da più aree
  lib/                      supabase, tz, money, range, database.types
  tenant/                   risoluzione della struttura e branding
```
Una feature non importa dai `components/` di un'altra: ciò che serve a due aree
si sposta in `shared/`. I test stanno accanto al file che provano.

## Ambiente locale
Questa macchina condivide Docker e le porte con altri progetti dell'utente.
- Non eseguire mai `docker system/image/volume prune` né rimozioni massive:
  ci sono stack `coolpim-*` e `coolsales-*` che non riguardano questo progetto.
  I container di questo progetto sono `supabase_*_pitchside`.
- Fermare Supabase con `npm run db:stop`, mai con comandi `docker` diretti.
- Non usare mai `pkill -f vite` o simili: altri progetti tengono aperti dei dev
  server. Terminare solo il PID esatto, dopo aver verificato `/proc/<pid>/cwd`.
