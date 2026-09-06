# Fase 1B · App cliente — specifica di progetto

**Data:** 6 settembre 2026
**Stato:** in revisione
**Perimetro:** la parte cliente della fase 1. Configurazione dell'impianto e
comunicazione hanno una loro specifica e un loro piano.
**Presuppone:** fase 1A in produzione — struttura, campi, tariffe, prenotazioni,
vincolo di esclusione, RLS, pannello del gestore.

---

## 1. Cosa stiamo costruendo

Oggi il prodotto ha una metà sola. Il gestore gestisce la giornata dal tablet;
il giocatore non ha una porta d'ingresso. Questa fase gliela dà: guardare quali
campi sono liberi senza account, entrare, prenotare, disdire, e ritrovare le
prenotazioni fatte per telefono negli anni precedenti.

Il metro di successo è uno solo: **il gestore riceve meno telefonate perché i
clienti prenotano da soli, e nessuna prenotazione si perde nel passaggio.**

Il rischio speculare è che l'app cliente sposti lavoro sul gestore invece di
toglierne — richieste da approvare, doppioni da fondere, code da smaltire. Ogni
scelta qui sotto è fatta per evitarlo.

---

## 2. Le decisioni che reggono questa fase

### 2.1 Si entra con Google, non con l'SMS

La specifica di progetto pone due vincoli che confliggono: il telefono è
l'identità (§2.1), e il primo anno deve costare circa 12 € (§1). Gli SMS verso
l'Italia si pagano a messaggio su ogni provider: con l'accesso aperto ai
clienti, ogni sessione scaduta è un costo, e il vincolo salta al primo gruppo
che si registra.

Si risolve spostando l'SMS, non eliminandolo. **Google diventa la porta
principale**, gratuita e già disegnata nel mockup. L'SMS resta per chi non ha un
account Google.

Il telefono non sparisce: si chiede **dopo** il primo accesso, una volta, ed è
lì che serve — per il ricongiungimento e perché il gestore possa richiamare.

**Apple resta fuori da questa fase.** «Accedi con Apple» richiede un account
Apple Developer a pagamento, e la specifica di progetto mette quei 99 $/anno in
fase 4 (§10.5). Il pulsante è disegnato nel mockup e il codice lo prevederà, ma
resta spento finché quel conto non si paga — cioè quando serve comunque, per
pubblicare sullo store. Metterlo in questa fase significherebbe anticipare di
tre fasi una spesa per un beneficio che Google già copre.

### 2.2 Il telefono lo verifica Supabase, non noi

Con l'accesso via Google il numero non è più verificato da nessuno. Ma
rivendicare una scheda `members` significa ereditarne storico, prenotazioni e
affidabilità: senza verifica, chiunque conosca il numero di un altro si prende
la sua storia.

Il numero si verifica con **un SMS, una volta per cliente, per sempre** — non
uno per accesso. Il costo torna dentro il vincolo.

La verifica non la implementiamo noi: si usa `updateUser({ phone })` di
Supabase, che manda il codice e, alla conferma, scrive il numero su
`auth.users.phone`. La funzione di ricongiungimento legge **solo** il numero
verificato che arriva dal token, mai una stringa mandata dal client. È questa
la differenza fra una verifica e un campo di testo.

### 2.3 Le RPC devono autorizzare, non solo eseguire

`create_booking` e `cancel_booking` sono `security definer`, concesse a
`authenticated`, e non guardano mai chi le chiama: `auth.uid()` compare una
volta sola, per riempire `created_by`. Serve a tracciare, non ad autorizzare.

Verificato in locale il 6 settembre 2026: un utente autenticato che **non** è
amministratore, e a cui la RLS nega la lettura di ogni prenotazione (`select`
restituisce `[]`), ha disdetto la prenotazione di un altro cliente in una
struttura di cui non fa parte, ricevendo indietro la riga intera — `member_id`,
`facility_id`, prezzo. La RLS sulla tabella è corretta; la `security definer` le
passa attraverso.

In fase 1A era latente: l'unica sessione esistente era quella del gestore.
**Aprire l'accesso ai clienti la rende sfruttabile da chiunque.** È la prima
cosa da fare in questa fase, prima di qualunque schermata.

I test pgTAP non l'hanno vista perché girano da superutente, dove `auth.uid()`
è nullo e l'autorizzazione non viene mai esercitata. Anche questo va corretto:
i test devono impersonare un utente.

### 2.4 Nessun limite di prenotazione, e la scelta è consapevole

Un cliente può prenotare quanto vuole. Se qualcuno esagera, il gestore lo vede
dalla griglia e disdice.

È una decisione presa sapendo il rischio: una persona sola può occupare tutti e
tre i campi fino all'orizzonte di prenotazione, e il rimedio arriva dopo il
danno. Si accetta perché il gestore ha la griglia sotto gli occhi tutto il
giorno e disdire gli costa due clic, mentre una regola sbagliata gli costerebbe
spiegazioni al telefono ogni volta che scatta.

Se un giorno servisse, il posto dove aggiungerla è `create_booking`, accanto
all'orizzonte e alla durata minima. Non serve altro lavoro preparatorio.

### 2.5 Una sola applicazione

L'app cliente vive nella stessa SPA del pannello, con rotte proprie. Riusa
`FacilityProvider`, `AuthProvider`, `tz.ts`, `money.ts` senza modifiche.

L'alternativa — due entry point separati — darebbe una prima schermata più
leggera sulla home pubblica, ma al prezzo di due build, due deploy, provider
duplicati e una domanda aperta in fase 4 con Capacitor. Quasi tutto il guadagno
si ottiene caricando `/admin` in modo pigro, che costa una riga.

---

## 3. Architettura

Nessun componente nuovo rispetto alla fase 1A: stessa SPA, stesso backend.

```
src/
  public/
    HomePage.tsx            home pubblica, disponibilità di oggi
    BookPage.tsx            scelta campo, giorno, ora
    BookPage.hooks.ts       busy_slots + fasce libere
    ConfirmDialog.tsx       riepilogo e conferma
    MyBookingsPage.tsx      le tue prenotazioni, passate e future
    BookingPage.tsx         dettaglio, disdetta
  auth/
    ClaimPhoneDialog.tsx    telefono + verifica + rivendicazione
  App.tsx                   /admin diventa lazy
```

**Rotte**, come dichiarate nel catalogo delle schermate:

| Rotta | Accesso |
|---|---|
| `/` | anonimo |
| `/prenota` | anonimo per guardare, autenticato per confermare |
| `/prenotazioni` | autenticato |
| `/prenotazioni/:id` | autenticato, solo le proprie |
| `/accedi` | anonimo |

`/admin` passa a `lazy()`: chi apre la home non scarica il pannello.

---

## 4. Modello dati

**Nessuna colonna nuova.** Il modello della fase 1A regge già questa fase, e
vale la pena dirlo esplicitamente perché è la prova che le decisioni di allora
erano giuste: `members.user_id` nullable esiste apposta per il momento in cui
un cliente rivendica la sua scheda.

Due colonne che avevo previsto e che ho tolto rileggendo:

- `members.claimed_at` — `user_id is not null` dice già che la scheda è stata
  rivendicata. Una seconda colonna sarebbe un secondo posto da tenere allineato.
- `facilities.booking_page_note` — una nota che il gestore non può modificare,
  perché l'interfaccia di configurazione è nell'altro sottoprogetto. Si aggiunge
  lì, insieme al posto dove la si scrive.

Nessuna colonna nemmeno per il telefono verificato: la verità sta in
`auth.users.phone`, scritta da Supabase dopo la conferma del codice. Duplicarla
nel dominio significherebbe doverla tenere allineata, e il primo disallineamento
sarebbe un ricongiungimento sbagliato.

**Funzioni nuove**

```
claim_members_by_verified_phone() returns setof members
```

Legge il numero verificato dal token del chiamante, cerca le `members` di quel
numero con `user_id` nullo, le collega all'account e restituisce quelle
collegate. Non accetta parametri: un parametro sarebbe una stringa mandata dal
client, cioè esattamente ciò da cui la verifica deve proteggere.

**Funzioni da correggere**

```
create_booking(...)   deve rifiutare chi non è né amministratore
                      né proprietario del member indicato
cancel_booking(...)   deve rifiutare chi non è né amministratore
                      né proprietario della prenotazione
```

Un cliente non deve nemmeno poter scegliere l'origine: se non è amministratore,
`source` è `'app'` e basta. Altrimenti una prenotazione dall'app potrebbe
travestirsi da telefonata e sfuggire ai limiti che un giorno metteremo.

---

## 5. Regole di dominio

### 5.1 Guardare senza account

La disponibilità si legge dalla vista `busy_slots`, che espone struttura, campo
e intervallo e nient'altro — né chi ha prenotato, né a quanto. Esiste dalla fase
1A ed è già coperta da test.

Le fasce libere si calcolano nel client sottraendo gli slot occupati
dall'orario di apertura. Il prezzo mostrato viene da `price_bands`, che è
pubblica in lettura.

### 5.2 Prenotare

Stessa `create_booking` del gestore, stessa transazione, stesso vincolo di
esclusione. Il cliente non ha un percorso privilegiato né uno penalizzato: se
due persone confermano lo stesso slot nello stesso istante, una delle due riceve
`PS004` e la griglia del gestore lo mostra in tempo reale.

L'orizzonte di prenotazione (`booking_horizon_days`) vale per lui e non per il
gestore, come già stabilito in fase 1A.

### 5.3 Disdire

Il cliente disdice le proprie prenotazioni fino alla scadenza scritta sulla
prenotazione. Dopo, il pulsante resta ma avvisa che risulterà come mancata
presenza e inciderà sull'affidabilità — la stessa frase che vede il gestore,
perché la regola è la stessa.

### 5.4 Ritrovare lo storico

Al primo accesso, se l'account non ha ancora un numero verificato, si chiede.
Verificato il numero, si cercano le schede con quel telefono e `user_id` nullo:
se ce ne sono, si mostra cosa si sta per ereditare — quante prenotazioni, da
quando — e si chiede conferma.

È il momento in cui il prodotto mantiene la promessa della specifica: *chi ha
prenotato per anni al telefono ritrova il suo storico al primo accesso, senza
che nessuno faccia niente.*

---

## 6. Sicurezza

Oltre alla correzione delle RPC (§2.3):

- I test pgTAP devono **impersonare un utente**, non girare da superutente:
  `set local role authenticated` e `set local request.jwt.claims`. Senza,
  `auth.uid()` è nullo e nessun controllo di autorizzazione viene provato.
- Ogni RPC nuova o corretta ha un test che prova il caso negativo: non basta
  verificare che il proprietario riesca, serve verificare che un altro fallisca.
- `claim_members_by_verified_phone` non accetta parametri, per costruzione.

---

## 7. Fuori perimetro

- **Pagamenti online.** Si paga in struttura, come in tutte le fasi.
- **Partite aperte, inviti, messaggi.** Fase 3.
- **Bacheca e notifiche di promemoria.** Sono l'altro sottoprogetto della 1B.
- **Configurazione dell'impianto dall'interfaccia.** Idem.
- **Limiti di prenotazione per cliente.** Decisione §2.4.
- **Spostare una prenotazione.** Il cliente disdice e riprenota. Lo spostamento
  resta una funzione del gestore.

---

## 8. Rischi

| Rischio | Perché fa paura | Mitigazione |
|---|---|---|
| Le RPC restano aperte | oggi è un buco dimostrato, e i clienti autenticati lo rendono sfruttabile | primo task della fase, con test sul caso negativo |
| Ricongiungimento sbagliato | un cliente eredita lo storico di un altro | il numero arriva dal token verificato, mai dal client |
| Un cliente occupa tutto | scelta consapevole §2.4 | il gestore vede e disdice; la regola si aggiunge dove serve |
| Doppioni in anagrafica | due schede per la stessa persona | `pickExistingMember` argina in inserimento; la fusione è nell'altro sottoprogetto |
| Costo SMS fuori controllo | il vincolo di budget | un SMS per cliente, non per accesso |

---

## 9. Cosa serve prima di cominciare

Due cose che non sono codice e che nessuno può scrivere al posto del titolare
del progetto. Vanno procurate prima del task che le usa, altrimenti
l'implementazione si ferma a metà:

| | Chi | Costo |
|---|---|---|
| Credenziali OAuth Google — un progetto su Google Cloud, ID e segreto client, con l'URL di richiamo di Supabase fra quelli ammessi | Francesco | gratis |
| Account su un provider SMS e credenziali per Supabase | Francesco | a consumo, un SMS per cliente |

Fino ad allora si lavora con l'ambiente locale: i numeri di prova in
`[auth.sms.test_otp]` e l'accesso Google simulato.

---

## 10. Assunzioni

1. **Google copre la quasi totalità dei giocatori.** Chi non ce l'ha passa
   dall'SMS. Apple arriva in fase 4, insieme al conto che la rende possibile.
2. **Il gestore continua a inserire le telefonate.** L'app cliente si aggiunge
   al canale telefonico, non lo sostituisce.
3. **Nessun limite di prenotazione**, con il rischio accettato in §2.4.
4. **Un solo tenant**, come in fase 1A.

---

## Riferimenti

- Specifica di progetto: `docs/superpowers/specs/2026-09-05-prenota-campi-design.md`
- Piano fase 1A: `docs/superpowers/plans/2026-09-05-fase-1a-prenotazioni.md`
- Mockup: `docs/mockups/` — schermate cliente e rotte reali
