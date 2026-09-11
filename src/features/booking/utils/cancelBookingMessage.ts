// Stessi codici del gestore (src/features/admin/utils/cancelBookingMessage.ts),
// frasi diverse: al cliente non interessa cosa è successo sul server, gli
// interessa cosa fare adesso.
const MESSAGES: Record<string, string> = {
  PS009: 'Non troviamo più questa prenotazione. Ricarica la pagina.',
  PS010: 'L’avevi già disdetta.',
  PS012: 'Accedi di nuovo per completare la disdetta.',
  PS013: 'Non puoi disdire una prenotazione che non è tua.',
}

export function messageForCustomer(code: string): string {
  return MESSAGES[code] ?? 'La disdetta non è riuscita. Riprova.'
}
