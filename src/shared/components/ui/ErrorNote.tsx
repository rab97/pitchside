/**
 * Un guasto non è un dato di fatto.
 *
 * Sei ganci di questa fase leggevano `data` e `isPending` e buttavano
 * `error`: a parità di rete rotta il cliente leggeva «Nessun campo
 * disponibile», «Non hai ancora prenotazioni», «Questa prenotazione non
 * esiste» — affermazioni sbagliate, e mai un errore. Questa nota è il posto
 * dove un guasto si dice per quello che è, distinto dal vuoto.
 *
 * `role="alert"` perché arriva dopo che la pagina è già a schermo: chi usa
 * uno screen reader deve sentirla senza andarla a cercare.
 */
export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-lg border border-terra bg-terra-tint px-3 py-2 text-[12.5px] text-terra"
    >
      {message}
    </p>
  )
}
