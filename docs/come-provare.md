# Come provare l'app a mano

Guida per verificare da soli cosa fa il prodotto, senza fidarsi dei test.
Ogni scenario dice **cosa fare** e **cosa devi vedere**: se vedi altro, è un
difetto e vale la pena segnalarlo.

Il tempo totale è circa mezz'ora. Gli scenari 6 e 7 sono i più interessanti:
provano che un cliente non possa vedere né toccare i dati di un altro.

---

## Prima di iniziare

```bash
npm run db:start                    # Supabase in Docker, ~30 secondi
npm run dev -- --port 5174          # la 5173 è di un altro progetto
```

Poi, per avere uno storico da ritrovare (il seed crea i clienti ma nessuna
prenotazione):

```bash
docker exec -i supabase_db_pitchside psql -U postgres -d postgres \
  < scripts/demo-storico.sql
```

Dà a **Giulio Dante** tre prenotazioni passate — una disdetta — e una futura,
come se il gestore le avesse prese al telefono nei mesi scorsi.

**Per ricominciare da zero in qualsiasi momento:** `npm run db:reset`, poi
rilancia lo script sopra. Cancella tutto e rimette il seed.

### Chi puoi essere

In locale non parte nessun SMS: questi tre numeri accettano sempre il codice
**472839**. Google non funziona in locale, servono credenziali vere.

| Numero | Chi è |
|---|---|
| `347 220 15 63` | **Il gestore.** Amministratore del Palacalcetto, e anche cliente (Marco Ferrero) |
| `339 412 88 07` | **Giulio Dante.** Cliente storico con scheda creata dal gestore, nessun account |
| `340 118 77 21` | **Amici del Martedì.** Idem |

---

## 1 · Guardare senza account

Apri `http://localhost:5174` in una **finestra anonima**, così sei sicuro di non
avere una sessione.

Devi vedere: nome, indirizzo e telefono del Palacalcetto, e i tre campi con tipo
e copertura. Clicca «Prenota un campo».

Su `/prenota`, sempre senza account, devi vedere: i tre campi selezionabili, la
striscia dei sette giorni, i tre pulsanti della durata, e **gli orari liberi con
il loro prezzo**. È la regola fondante della parte cliente: si guarda senza
registrarsi.

Verifica il prezzo a cavallo di due fasce: con durata **1h**, il feriale
costa 20 € prima delle 19:00 e 25 € dopo, ma la partenza delle **18:30** deve
costare **22,50 €** — mezz'ora a un prezzo e mezz'ora all'altro. Se costasse 20
o 25, il calcolo del prezzo sarebbe sbagliato.

## 2 · Prenotare, e ritrovarsi dove si era

Scegli un campo, un giorno e un'ora, poi «Conferma». Non hai un account, quindi
finisci sulla schermata d'accesso.

Entra con `339 412 88 07` e codice `472839`.

Devi tornare su `/prenota` **con la scelta di prima già selezionata** e il
riepilogo riaperto. È il punto in cui l'app si gioca l'adozione: se ti facesse
ricominciare, un cliente vero telefonerebbe invece di riprovare.

Conferma. Devi leggere un avviso con data, ora e importo da pagare in struttura.

## 3 · Ritrovare lo storico di anni

Questa è la promessa centrale della fase.

Al primo accesso con Google ti verrebbe chiesto il numero; entrando via SMS il
numero è già verificato, quindi il ricongiungimento avviene da solo. Vai su
**«Le mie prenotazioni»** dalla home.

Devi vedere **quattro prenotazioni oltre a quella che hai appena fatto**: una
futura fra le «prossime», e tre fra le «passate», di cui una etichettata come
disdetta. Sono le prenotazioni che il gestore aveva preso al telefono per Giulio
Dante: le hai ereditate verificando il numero.

Le disdette restano visibili di proposito: sparire non è la stessa cosa che
essere disdetta, e un cliente che non ritrova una prenotazione che ricorda pensa
che il sistema l'abbia perduta.

## 4 · Disdire entro il termine

Clicca la prenotazione futura fra le «prossime». Si apre il dettaglio: campo,
giorno, orario, importo, e **la scadenza di disdetta**.

Premi «Disdici la prenotazione». Devi leggere:

> Disdici entro il termine e non paghi nulla: il campo torna libero per gli altri.

Conferma. Poi torna su `/prenota`, stesso campo e stesso giorno: **l'orario deve
essere di nuovo libero**. È la parte della frase che va verificata, non creduta.

## 5 · Disdire in ritardo

Serve una prenotazione oltre il termine. La crei così:

```bash
docker exec supabase_db_pitchside psql -U postgres -d postgres -c "
set local role authenticated;
set local request.jwt.claims to '{\"sub\":\"a0000000-0000-0000-0000-000000000001\",\"role\":\"authenticated\"}';
select id from public.create_booking(
  'c0000000-0000-0000-0000-000000000001',
  tstzrange((current_date + time '21:00') at time zone 'Europe/Rome',
            (current_date + time '22:00') at time zone 'Europe/Rome'),
  (select id from public.members where phone = '3394128807'), 'phone');"
```

È stasera alle 21:00, e la disdetta gratuita scade 24 ore prima: sei già oltre.

In `/prenotazioni` aprila. La scadenza deve essere **in arancione, con
«· scaduta»** accanto. Premendo «Disdici» devi leggere:

> Siamo oltre il termine: la prenotazione risulterà come mancata presenza e
> inciderà sulla tua affidabilità.

È l'unica conseguenza reale che il prodotto impone a un giocatore, e deve essere
detta **prima** di premere. Dopo aver confermato, verifica che sia stata
registrata:

```bash
docker exec supabase_db_pitchside psql -U postgres -d postgres -c \
  "select name, honored_count, missed_count from public.members where phone = '3394128807';"
```

`missed_count` deve essere passato a **1**.

## 6 · Provare a vedere le prenotazioni di un altro

Prendi l'identificativo di una prenotazione che **non** è tua:

```bash
docker exec supabase_db_pitchside psql -U postgres -d postgres -qAt -c "
select b.id from public.bookings b join public.members m on m.id = b.member_id
where m.phone <> '3394128807' limit 1;"
```

Se non restituisce niente, creane una per un altro cliente dal pannello del
gestore (scenario 8) e riprova.

Con la sessione di Giulio Dante, apri `http://localhost:5174/prenotazioni/<quell-id>`.

Devi leggere che **la prenotazione non esiste**. Non «non hai accesso»: la
differenza conta, perché la seconda formulazione confermerebbe a un estraneo che
quella prenotazione esiste.

## 7 · Provare a disdire la prenotazione di un altro

Lo stesso, ma dall'API, saltando l'interfaccia — che è come ci proverebbe
qualcuno davvero.

```bash
KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2)
TOKEN=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/verify" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"phone":"+393394128807","token":"472839","type":"sms"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -s -X POST "http://127.0.0.1:54321/rest/v1/rpc/cancel_booking" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"p_booking_id":"<id di un altro>"}'
```

Deve rispondere:

```json
{"code":"PS013","message":"Non puoi disdire questa prenotazione."}
```

E la prenotazione deve essere ancora `active`. Prima di questa fase rispondeva
`200` e la cancellava: era il difetto da cui è nato tutto il lavoro.

Prova anche a leggere l'anagrafica con la sola chiave pubblica:

```bash
curl -s "http://127.0.0.1:54321/rest/v1/members?select=name,phone,notes" -H "apikey: $KEY"
```

Deve restituire `[]`. E questa, che nella fase 1A restituiva nome, telefono,
email e note interne di chiunque:

```bash
curl -s -X POST "http://127.0.0.1:54321/rest/v1/rpc/find_members_by_phone" \
  -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"p_phone":"3394128807"}'
```

Deve rispondere `PGRST202`: la funzione non esiste più.

## 8 · Il lato gestore, e la collisione

Apri `http://localhost:5174/admin` in una **seconda finestra** ed entra con
`347 220 15 63`, codice `472839`. Vedi la griglia dei tre campi.

Tieni aperta anche la finestra del cliente su `/prenota`, stesso giorno.

- **Realtime:** inserisci una prenotazione dalla griglia. Nella finestra del
  cliente quell'orario deve **sparire dai liberi entro un secondo**, senza
  ricaricare.
- **Collisione:** scegli lo stesso orario da entrambe le finestre e conferma
  quasi insieme. Una delle due deve leggere «Qualcuno ha appena preso questo
  slot. Scegline un altro.» — mai un errore tecnico, e mai due prenotazioni
  sullo stesso campo alla stessa ora.

## 9 · I limiti che il database impone

- **L'ultimo giorno della striscia** su `/prenota`: scorri fino in fondo. Il
  giorno oltre l'orizzonte di prenotazione (60 giorni) non deve offrire orari
  che poi verrebbero rifiutati.
- **Durata minima:** con durata `1h`, l'ultima partenza deve essere alle 23:00
  e non alle 23:30, perché l'impianto chiude a mezzanotte.
- **Ogni orario in elenco deve avere un prezzo.** Se ne vedi uno con `—`, è un
  difetto: significa che l'elenco degli orari e la fonte del prezzo si sono
  disallineati.

## 10 · Installabile sul telefono

```bash
npm run build && npm run preview
```

Nel browser, strumenti da sviluppatore → **Application**: il manifest deve
essere valido e il service worker registrato. Nella cache («Cache Storage»)
devono esserci **solo file dell'app** — nessuna chiamata a Supabase: una risposta
in cache su un orario libero mostrerebbe come disponibile uno slot già preso.

Poi crea una prenotazione e verifica che compaia **senza svuotare la cache**.

---

## 11 · Configurare l'impianto

Questo scenario chiude la fase 1B: un campo nuovo, il suo prezzo, e una
chiusura che lo toglie di mezzo con dentro una prenotazione vera — non da
`psql`, dal pannello.

Entra come gestore (`347 220 15 63`, codice `472839`) su `/admin/campi`.

**Aggiungi un quarto campo.** «Aggiungi campo» → nome `Campo 4`, un tipo e una
superficie a piacere. Deve comparire in fondo alla lista, attivo.

Vai su **Tariffe**, seleziona **Campo 4**. Devi leggere: «Questo campo non ha
tariffe: è chiuso tutti i giorni. Aggiungi una fascia per aprirlo.» — è vero,
finché non gli dai un prezzo.

**Prezzalo per l'intera settimana.** «Aggiungi fascia» → tutti e sette i
giorni selezionati, dalle `00:00` alle `24:00`, un prezzo a piacere. Salva: la
settimana di Campo 4 deve colorarsi tutta, senza nessun tratto «chiuso».

Apri `/prenota` in una **seconda scheda**, senza account. **Campo 4** deve
comparire fra i campi selezionabili, con gli orari liberi e il prezzo appena
scritto — non una stima.

**Prenota su Campo 4.** Scegli un giorno e un'ora su quel campo, conferma;
entra con `339 412 88 07` e codice `472839` (Giulio Dante), poi conferma di
nuovo. Devi tornare con la prenotazione fatta.

Torna alla scheda del gestore, su **Chiusure**. «Aggiungi chiusura» → campo
**Campo 4**, un periodo che copre l'orario appena prenotato, un motivo a
piacere. Deve comparire l'anteprima con la prenotazione di Giulio Dante — nome
e telefono — sopra la frase che avverte che chiudendo verrà disdetta, e,
subito sotto, questa, che non deve mai mancare:

> I clienti non ricevono ancora un avviso: chiamali tu.

Qui la prenotazione in conflitto è **una sola**, e ogni parola che la
accompagna deve essere al singolare. L'avviso sopra l'elenco non porta nessun
numero — dice «Chiudendo, questa prenotazione verrà disdetta.» — e non andarlo
a cercare: il conteggio compare solo in due punti, sul pulsante che conferma,
«Chiudi e disdici 1 prenotazione», e poi nel messaggio che arriva dopo,
«Chiusura salvata. Disdetta 1 prenotazione.». Un «queste 1 prenotazioni», o un
«Disdette 1 prenotazioni», è un difetto da segnalare: questa è la schermata in
cui il gestore decide di disdire la partita a qualcuno, e si legge come un
conto fatto male.

Torna sulla scheda del cliente e apri `/prenotazioni`: la prenotazione che
avevi appena fatto deve comparire fra le passate, etichettata **Disdetta** —
l'ha cancellata la chiusura, non tu.

---

## 12 · Le stesse tre cose, ma col pollice

I campi di data e ora del pannello, e il riordino dei campi, hanno preso il
posto dei controlli nativi del telefono — la ruota di `<input type="date">`,
in particolare, che era grande, familiare e gratis. Questo scenario esiste
solo per verificare che non abbiamo peggiorato quello che abbiamo sostituito:
va provato su un **telefono vero**, non in una finestra del browser ridotta.
Una finestra stretta con l'emulazione touch mostra se qualcosa si rompe nel
layout, ma non dice come un controllo si sente sotto un pollice vero, né
arbitra un vero scorrimento col dito contro un trascinamento.

Avvia il server rivolto alla rete locale:

```bash
npm run dev:phone   # porta 5175, ascolta su tutte le interfacce di rete
```

Trova l'indirizzo di questa macchina sulla Wi-Fi (`ip addr` o le impostazioni
di rete: qualcosa come `192.168.1.x`) e apri `http://<quell'indirizzo>:5175/admin`
dal telefono, sulla stessa rete. Entra come gestore (`347 220 15 63`, codice
`472839`).

**1 · Una data, col pollice.** Su **Chiusure** → «Aggiungi chiusura», tocca il
campo «Da». Deve aprirsi la griglia del mese, non la ruota nativa del
telefono. Ogni giorno deve essere comodo da centrare al primo tocco, senza
mirare con cura né allontanare lo schermo per vederci meglio. Confrontalo
onestamente con la ruota che sostituisce: se quella era più comoda, è un
difetto da scrivere, non da archiviare — lo dice la specifica di questo
lavoro, non solo questa guida.

**2 · Un'ora, da una lista di 97.** Nello stesso dialogo, tocca un campo
orario. Deve aprirsi un elenco che scorre con un dito come scorrerebbe
qualunque lista lunga — senza salti, senza una riga che sfugge al tocco e ne
seleziona un'altra. Raggiungere un orario lontano da mezzanotte non deve
servire più di uno o due scorrimenti.

**3 · Un campo, trascinato con un dito.** Su **Campi**, appoggia il dito sulla
maniglia a sinistra del nome di un campo (le tre righe orizzontali) e
trascinala sopra un altro campo della lista. La riga deve seguire il dito da
subito; se invece si muove la pagina intera e il campo resta fermo, la
maniglia ha fallito il suo unico compito. Rilascia: l'ordine deve restare
quello a cui l'hai portato, e ricaricando la pagina non deve tornare quello
precedente.

> Nota per chi legge prima di avere un telefono in mano, con le misure lette
> nel codice: la cella di un giorno del calendario è 44×44px — la soglia che
> questa guida chiede — e lo sono anche le frecce del mese. La maniglia di
> trascinamento è un bottone di 44×44px: le tre righe che si vedono sono un
> `<svg>` di 20×20px disegnato dentro di esso, e sono il bottone intero — non
> il solo glifo — a portare l'ascolto del trascinamento e il `touch-none` che
> impedisce al browser di scambiare il dito per uno scorrimento di pagina.
> Nessuno dei due controlli ha quindi un difetto di misura noto da imputare in
> partenza: se al punto 1 o al punto 3 qualcosa risulta comunque scomodo, è
> un'informazione nuova e va segnalata com'è — la soglia rispettata non è la
> prova che sotto un pollice vero funzioni.

---

## I test automatici

```bash
npm run test        # 211 test: funzioni pure, messaggi d'errore, render
npm run test:db     # 84 test pgTAP: regole di dominio, RLS, autorizzazione
npm run build       # compilazione e pacchetti
```

I pgTAP sono i più interessanti da leggere: `supabase/tests/007_rpc_authorization.test.sql`
prova che un cliente non possa agire per conto di un altro,
`008_member_identity.test.sql` che lo storico si ricongiunga senza creare
doppioni, `011_bookings_policy_sum.test.sql` perché la pagina «le tue
prenotazioni» filtra per conto proprio invece di fidarsi della sola RLS.

## Cosa non si può provare in locale

- **L'accesso con Google.** Servono credenziali di un progetto Google Cloud. In
  locale funziona solo l'SMS coi tre numeri di prova.
- **Gli SMS veri.** Nessun messaggio parte: il codice `472839` arriva da una
  mappa in `supabase/config.toml`.
- **Le notifiche di promemoria e la bacheca.** Non sono in questa fase.
