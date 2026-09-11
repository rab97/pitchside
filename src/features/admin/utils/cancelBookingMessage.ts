// Le chiavi sono gli SQLSTATE alzati da `cancel_booking` (vedi
// `src/features/booking/utils/cancelBookingMessage.ts` per la versione che
// legge il cliente): qui il gestore deve sapere cosa è successo, non cosa
// fare — è lui a decidere il prossimo passo.
const MESSAGES: Record<string, string> = {
  PS009: 'Questa prenotazione non esiste più.',
  PS010: 'Era già stata disdetta.',
  PS012: 'Devi accedere per disdire.',
  PS013: 'Non puoi disdire la prenotazione di un altro.',
}

export function messageForError(code: string): string {
  return MESSAGES[code] ?? 'La disdetta non è riuscita. Riprova.'
}
