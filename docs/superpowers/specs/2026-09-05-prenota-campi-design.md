# Prenota Campi — specifica di progetto

**Data:** 5 settembre 2026
**Stato:** approvata per la stesura del piano di implementazione
**Perimetro del piano:** solo la **fase 1**. Le fasi 2, 3 e 4 avranno una loro specifica e un loro piano.
**Primo cliente:** Palacalcetto, Alba — tre campi, un solo tenant per almeno un anno

---

## 1. Cosa stiamo costruendo

Un prodotto per la prenotazione di campi da calcio, usato da due tipi di persone:

- **Il gestore dell'impianto**, che oggi prende le prenotazioni al telefono e deve continuare a poterlo fare, ma dentro il sistema.
- **I giocatori**, che prenotano, giocano tornei, cercano compagni di partita e ritrovano il proprio storico.

Il prodotto nasce per un impianto solo, ma è progettato fin dal primo giorno per servirne molti: ogni tabella è scoped per struttura, le funzionalità si accendono e si spengono per struttura, e il branding arriva dai dati.

**Vincolo di riferimento:** il primo anno deve costare circa 12 € (il dominio). Tutto il resto sta nei piani gratuiti.

---

## 2. Le decisioni che reggono il progetto

Queste non sono dettagli implementativi: sono le scelte da cui discende il modello dati. Cambiarne una dopo significa migrare dati di produzione.

### 2.1 Il telefono è l'identità

Si accede col numero di telefono (OTP via SMS), non con l'email. È l'unico dato che il gestore ha già di ogni cliente: chi ha prenotato per anni al telefono ritrova il suo storico al primo accesso, senza che nessuno faccia niente. Google e Apple restano come scorciatoia.

### 2.2 Cliente, giocatore e utente sono la stessa cosa

Una sola tabella `members`, con `user_id` **nullable**. Copre:

- chi telefona e non avrà mai l'app (riga con `user_id` nullo, creata dal gestore)
- chi viene aggiunto da un capitano scrivendo un nome (idem)
- chi usa l'app (riga con `user_id` valorizzato)

Le statistiche puntano sempre a `member_id`, **mai** a `user_id`. È l'unico modo perché la classifica marcatori di un torneo sia completa invece di contare solo chi ha scaricato l'app.

### 2.3 Identità globale, appartenenza per struttura

Supabase ha una sola `auth.users` per progetto: l'utenza separata per tenant richiederebbe un progetto per cliente, il che distrugge l'economia del prodotto. Quindi **una identità, N righe `members`** — una per struttura.

Restano **per struttura**: statistiche, affidabilità, XP, livello, obiettivi, squadre, prenotazioni, note interne del gestore.
Restano **globali**: telefono, account, nome, foto, preferenze di notifica.

**Il gestore di una struttura non deve poter vedere che un utente gioca anche altrove.** È l'unico punto del sistema in cui un errore di permessi causa un danno commerciale.

### 2.4 Le squadre nascono solo dai tornei

Non esiste un pulsante "crea squadra". Una squadra nasce dentro l'iscrizione a un torneo e non esiste finché quell'iscrizione non è confermata. Senza questo vincolo il sistema si riempie di rose incomplete che non scenderanno mai in campo.

Tre presidi:
1. `teams` si crea solo attraverso una `registrations`
2. l'iscrizione non si invia finché la rosa non raggiunge il minimo del torneo
3. le bozze non completate scadono alla chiusura delle iscrizioni, insieme ai `members` creati solo per loro

Per giocare col gruppo del martedì non serve una squadra: serve una **partita aperta**, che dura una sera e non lascia scorie.

### 2.5 La logica critica sta in Postgres

Creazione e disdetta prenotazione, accettazione in una partita aperta, salvataggio del tabellino, calcolo XP: funzioni `plpgsql` chiamate via RPC, **non** logica nel client né in Edge Function. Il motivo è preciso: girano nella stessa transazione del vincolo di esclusione, ed è questo che rende reale la garanzia anti-doppia-prenotazione.

Le Edge Function servono solo per ciò che parla col mondo esterno: SMS, email, push.

### 2.6 Il livello non sblocca funzioni

XP e livelli sono riconoscimento, non privilegio. Nessuna parte dell'app è riservata ai livelli alti. Eventuali vantaggi commerciali sono una decisione del gestore, fuori dal prodotto.

---

## 3. Architettura

```
Browser / App                     Supabase
┌────────────────────┐            ┌──────────────────────────┐
│ React + TypeScript │            │ Postgres                 │
│ Vite (SPA)         │──REST/RPC─▶│  ├ tabelle + RLS         │
│ TanStack Query     │            │  ├ funzioni plpgsql      │
│ Tailwind + shadcn  │◀─Realtime──│  └ vincoli di esclusione │
│ vite-plugin-pwa    │            │ Auth (OTP telefono)      │
└────────────────────┘            │ Storage (loghi, foto)    │
         │                        │ Edge Functions (Deno)    │
    Capacitor (fase 4)            └──────────────────────────┘
                                            │
                                   SMS · Email · Push
```

**Stack**

| Ambito | Scelta |
|---|---|
| Base | React + TypeScript + Vite, SPA |
| Routing | React Router |
| Dati | TanStack Query + `supabase-js`, tipi generati da `supabase gen types` |
| Form | react-hook-form + Zod (schemi condivisi con la validazione server) |
| UI | Tailwind + shadcn/ui (componenti in repo, non dipendenza) |
| Tabelle | TanStack Table |
| Date | date-fns + date-fns-tz, `Europe/Rome` esplicito |
| Notifiche | Web Push (service worker), FCM/APNs via Capacitor in fase 4 |
| Migrazioni | Supabase CLI, versionate in git |
| Test | pgTAP (regole DB e RLS), Vitest, Playwright sui flussi critici |

**Niente Next.js:** il rendering lato server non serve (il backend è Supabase) e non convive bene con Capacitor, che vuole un pacchetto statico. La SEO della pagina pubblica si risolve con una pagina statica separata.

**Risoluzione del tenant:** un solo modulo `resolveTenant()` con due implementazioni — hostname sul web, preferenza memorizzata su nativo. L'app nativa non ha un hostname: prevederlo ora costa nulla, scoprirlo dopo costa una rifattorizzazione diffusa.

---

## 4. Modello dati

Convenzione: ogni tabella ha `facility_id`, tutte le date sono `timestamptz`.

### Struttura e configurazione

| Tabella | Campi principali |
|---|---|
| `facilities` | slug, nome, colore, contatti, orari apertura, `features` jsonb, regole prenotazione |
| `facility_domains` | facility_id, hostname (per i domini personalizzati) |
| `fields` | nome, tipo (a 5 / a 7), superficie, coperto, attivo, ordine |
| `price_bands` | field_id, giorni della settimana, ora inizio, ora fine, prezzo/ora, validità |
| `closures` | field_id nullable, intervallo, motivo |

`price_bands` risponde al requisito: **l'admin sceglie il costo per ogni fascia oraria e per ogni giorno**. Le fasce non si sovrappongono e devono coprire tutto l'orario di apertura; la validazione avviene al salvataggio.

### Persone

| Tabella | Campi principali |
|---|---|
| `members` | facility_id, **user_id nullable**, nome, telefono, email, tipo (persona/gruppo/squadra), listino, note interne, affidabilità, xp, livello |

Una persona con account che gioca in due strutture ha **due righe `members` con lo stesso `user_id`**.
Il ricongiungimento avviene per numero di telefono: alla registrazione si cercano le righe con quel numero e si propone di rivendicarle.

### Prenotazioni

| Tabella | Campi principali |
|---|---|
| `bookings` | field_id, member_id, `slot tstzrange`, stato, origine (telefono/app/torneo), prezzo, recurrence_id nullable, scadenza disdetta |
| `recurrences` | field_id, member_id, giorno della settimana, ora, durata, dal/al |
| `booking_participants` | booking_id, member_id, stato (invitato/richiesto/accettato) |
| `open_matches` | booking_id, posti totali, nota dell'organizzatore, aperta |

**Il vincolo che regge tutto:**

```sql
ALTER TABLE bookings ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (field_id WITH =, slot WITH &&)
  WHERE (status = 'active');
```

### Tornei, squadre, statistiche

| Tabella | Campi principali |
|---|---|
| `tournaments` | nome, slug, formato, quota, rosa minima, apertura/chiusura iscrizioni |
| `registrations` | tournament_id, team_id, stato (bozza/in attesa/confermata), scadenza |
| `teams` | nome, colore, sport, capitano, registrazione di origine |
| `team_members` | team_id, member_id, ruolo, numero, periodo |
| `matches` | tournament_id, girone, giornata, squadre, booking_id nullable, punteggio |
| `match_stats` | match_id, member_id, gol, assist, gialli, rossi |
| `suspensions` | member_id, tournament_id, giornata, motivo |

### Gioco e comunicazione

| Tabella | Campi principali |
|---|---|
| `achievements` | codice, ambito (giocatore/squadra), nome, descrizione, xp, regola |
| `member_achievements` / `team_achievements` | soggetto, codice, data |
| `xp_events` | soggetto, delta, motivo, riferimento |
| `announcements` | titolo, testo, etichetta, pubblicato, notifica inviata |
| `messages` | tipo thread (partita/diretto), thread_id, member_id, testo |

---

## 5. Regole di dominio

### 5.1 Prenotazione

Una funzione `create_booking(field_id, slot, member, source)` che, in una sola transazione:
1. verifica che lo slot sia dentro l'orario di apertura e non in una chiusura
2. calcola il prezzo attraversando le `price_bands` che l'intervallo tocca (una prenotazione può attraversare due fasce: il prezzo è la somma proporzionale)
3. calcola la scadenza di disdetta dalle regole della struttura
4. inserisce; il vincolo di esclusione rifiuta la sovrapposizione con un errore gestito

La griglia del gestore è **realtime**: una prenotazione dall'app appare mentre lui è al telefono.

### 5.2 Ricorrenze

**Poche in numero, ma devono esistere.** Il gestore crea una ricorrenza e il sistema genera le occorrenze come `bookings` normali collegate da `recurrence_id`. Ogni occorrenza è cancellabile o spostabile singolarmente, senza toccare le altre. Se una generazione collide con una prenotazione esistente, quella data viene saltata e segnalata.

### 5.3 Fusi orari

Tutto `timestamptz`, tutto convertito in `Europe/Rome` per la visualizzazione. Serve un test esplicito sul cambio dell'ora legale: uno slot delle 21:00 dell'ultima domenica di ottobre.

### 5.4 Disciplina

Alla terza ammonizione nel torneo, o al primo rosso, il sistema genera una `suspensions` per la giornata successiva e notifica il capitano. Il gestore vede l'elenco degli squalificati per la prossima giornata.

Gol e assist sono **facoltativi**: senza, la classifica funziona. I cartellini **no**: da lì dipende chi può scendere in campo.

### 5.5 Affidabilità e XP

**Affidabilità** = percentuale di prenotazioni onorate su quelle concluse. È un numero pubblico, visibile a chi valuta una richiesta di ingresso in una partita e al gestore nell'anagrafica. Non è un obiettivo: esiste comunque.

**XP** da tre fonti: attività (partita +10, torneo +25, gol/assist +5), obiettivi (+50…+1.200), penalità (disdetta tardiva −50, espulsione −40, forfait squadra −200). Le penalità sono ciò che rende il sistema utile invece che decorativo.

Il ricalcolo avviene in una funzione Postgres, **innescata dagli eventi** (prenotazione conclusa, tabellino salvato), mai a ogni caricamento di pagina. La pagina legge righe già pronte.

XP giocatore e XP squadra sono **due progressioni separate**: nessuna delle due è la somma dell'altra.

---

## 6. Sicurezza

RLS attiva su ogni tabella, senza eccezioni. Tre profili:

| Profilo | Può |
|---|---|
| **Anonimo** | leggere campi liberi, tornei aperti, bacheca, informazioni della struttura |
| **Membro** | leggere e scrivere le proprie prenotazioni, partecipare alle partite aperte, leggere le statistiche pubbliche della propria struttura |
| **Gestore** | tutto, **limitatamente alla propria struttura** |

Regole non negoziabili:
- nessuna query attraversa `facility_id`
- il gestore non risale mai all'identità globale di un membro né alle sue righe in altre strutture
- i feature flag si applicano **anche lato server**: spegnere una funzione ne blocca le richieste, non solo la UI

Le policy RLS sono coperte da test pgTAP. È l'unica parte del sistema in cui un bug non si manifesta in sviluppo — dove c'è un tenant solo — e si manifesta il giorno del secondo cliente.

---

## 7. Perimetro per fase

### Fase 1 — Prenotazioni *(il gestore la usa ogni giorno)*
Fondamenta multi-tenant, RLS, accesso OTP · Griglia del giorno e inserimento telefonata · Ricorrenze · Campi, fasce tariffarie, chiusure, orari · Anagrafica clienti con creazione, modifica e fusione · Home pubblica e app cliente per prenotare e disdire · Bacheca avvisi · Notifiche di promemoria · PWA installabile · Impostazioni struttura e feature flag

### Fase 2 — Tornei e squadre *(quando parte il primo torneo)*
Giocatori senza account e fusione doppioni · Iscrizione al torneo con creazione squadra e rosa minima · Gironi e generazione calendario sui campi reali · Risultati, tabellino, marcatori e assist · Diffide e squalifiche automatiche · Pagine pubbliche del torneo

### Fase 3 — Community e progressione *(quando ci sono dati che valga la pena guardare)*
Partite aperte e richieste di ingresso · Messaggi di gruppo partita e diretti · Obiettivi giocatore e squadra · XP e livelli · Statistiche personali e storico

### Fase 4 — Store
Impacchettamento Capacitor, push native, materiali e revisione App Store e Play Store

---

## 8. Fuori perimetro

- **Pagamenti online.** Si paga in struttura. Stripe si aggiunge quando il gestore avrà un problema di no-show da risolvere.
- **Chat globale aperta a tutti.** I messaggi vivono dentro una partita o fra chi ci ha già giocato insieme. Una stanza pubblica richiederebbe moderazione umana continua, che nessuno farà.
- **Classifiche pubbliche fra utenti.** Trasformerebbero una comitiva di amici in una gara.
- **Un'app per ogni struttura sugli store.** Rischio concreto di rifiuto per guideline 4.3. Una sola app, la struttura si sceglie dentro.
- **Contabilità e fatturazione.**

---

## 9. Rischi

| Rischio | Perché fa paura | Mitigazione |
|---|---|---|
| Bug nelle policy RLS | non si vede con un tenant solo, si vede col secondo — ed è un danno commerciale | test pgTAP sulle policy fin dalla fase 1 |
| Il gestore non adotta il sistema | senza i suoi dati l'app cliente è vuota | la schermata di inserimento telefonata è la prima cosa da fare bene; affiancamento nei primi giorni |
| Ricorrenze con eccezioni | è la funzione che si sottostima sempre | modello a occorrenze generate, non a regola valutata a runtime |
| Ora legale | uno slot sbagliato di un'ora due volte l'anno | `timestamptz` ovunque, test dedicato sul cambio ora |
| Revisione Apple | tempi non comprimibili | mettere in conto due settimane; non è sviluppo, è calendario |
| Nessun backup sul piano free Supabase | una tabella cancellata per errore è definitiva | `pg_dump` notturno via GitHub Action dal primo giorno |

---

## 10. Assunzioni

1. **Un solo tenant per almeno un anno.** Le fondamenta multi-tenant si costruiscono comunque, ma non si sviluppa nessuna interfaccia di gestione multi-struttura.
2. **Le ricorrenze sono poche** ma devono funzionare correttamente. Non sono il centro della fase 1: il centro è la prenotazione ordinaria.
3. **Le tariffe variano per giorno e fascia oraria**, configurabili dall'admin per ogni campo.
4. **Nessun incasso online** in tutte e quattro le fasi.
5. **L'app parte come PWA.** I 99 $/anno di Apple si pagano in fase 4, non prima.
6. **Il branding di una struttura sta nei dati**: sigla, colore, nome e contatti si applicano a runtime come variabili CSS.

---

## Riferimenti

- Proposta di design: https://claude.ai/code/artifact/af1991c0-638b-4d26-895d-a5f4f00cc3aa
- Catalogo delle 26 schermate: https://claude.ai/code/artifact/630d85db-85d3-4d87-bf2d-d35a1213c155
