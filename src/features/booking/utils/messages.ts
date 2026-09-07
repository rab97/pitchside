/**
 * Le frasi con cui le schermate cliente dicono che qualcosa non è andato, e
 * quelle che due schermate diverse devono dire allo stesso modo.
 *
 * Stanno insieme per due ragioni trovate al riesame della fase:
 *
 * - lo stesso stato si diceva in due modi. La home diceva «Nessun campo
 *   disponibile al momento.» e la pagina di prenotazione «Nessun campo attivo
 *   in questa struttura.», per la stessa cosa — e lo dicevano entrambe
 *   *durante* il caricamento;
 * - un guasto si diceva come un dato di fatto. Con la rete rotta il cliente
 *   leggeva «Nessun campo disponibile», che è un'affermazione sul mondo, non
 *   un errore. Un vuoto e un guasto sono due cose diverse e vanno dette
 *   diversamente.
 */

export const NO_FIELDS = 'Nessun campo disponibile al momento.'

export const FIELDS_ERROR = 'Non siamo riusciti a caricare i campi. Riprova.'

export const SLOTS_ERROR =
  'Non siamo riusciti a caricare gli orari liberi. Riprova.'

export const MEMBER_ERROR =
  'Non siamo riusciti a preparare la tua scheda cliente: ricarica la pagina.'

export const MY_BOOKINGS_ERROR =
  'Non siamo riusciti a caricare le tue prenotazioni. Riprova.'

export const BOOKING_ERROR =
  'Non siamo riusciti a caricare questa prenotazione. Riprova.'
