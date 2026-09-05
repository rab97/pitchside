# Mockup

Due pagine HTML autonome: si aprono con doppio clic, non hanno dipendenze
esterne se non i font di Google.

| File | Cosa contiene |
|---|---|
| `01-proposta-design.html` | Proposta di design: home cliente (web e telefono), pannello gestore, note di progettazione |
| `02-catalogo-schermate.html` | Catalogo delle 26 schermate con le rotte, obiettivi, XP e livelli |

Il sistema di design vive nel blocco `<style>` in cima a ciascun file:
variabili CSS per colori e superfici, tema chiaro e scuro, scala tipografica.
Sono le stesse variabili che in produzione verranno impostate a runtime dal
record della struttura, per il branding per tenant.
