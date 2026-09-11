export type DragOutcome = 'open' | 'closed' | 'unchanged'

/**
 * Quanto bisogna trascinare perché il foglio scatti, invece di tornare da
 * dov'era: il 30% della corsa, mai meno di 40px.
 *
 * La soglia è relativa perché la corsa dipende dal contenuto — un foglio con
 * la nota della disdetta è più alto di uno senza — e una soglia fissa sarebbe
 * metà corsa su un foglio corto e un'unghia su uno lungo. Il minimo assoluto
 * esiste perché sotto i 40px non si distingue un trascinamento da un tocco
 * con la mano ferma: è la stessa tolleranza con cui i sistemi operativi
 * separano il tap dallo swipe.
 */
export function dragThreshold(travel: number): number {
  return Math.max(40, travel * 0.3)
}

/**
 * Dove finisce il foglio quando si alza il dito.
 *
 * `dy` è lo spostamento verticale in pixel, col segno del sistema di
 * coordinate dello schermo: negativo verso l'alto. Trascinare in su apre,
 * trascinare in giù chiude, e un trascinamento troppo corto non decide
 * niente — il foglio torna dov'era, che è ciò che si aspetta chi ha cambiato
 * idea a metà gesto.
 *
 * `travel` è la corsa disponibile, cioè l'altezza del dettaglio: serve per la
 * soglia relativa, vedi `dragThreshold`.
 *
 * Non si guarda `open` per decidere la direzione: chi trascina in su un
 * foglio già aperto ottiene «aperto», e non un'inversione a sorpresa.
 */
export function settleDrag({ dy, travel }: { dy: number; travel: number }): DragOutcome {
  const threshold = dragThreshold(travel)
  if (dy <= -threshold) return 'open'
  if (dy >= threshold) return 'closed'
  return 'unchanged'
}

/**
 * L'altezza del dettaglio mentre il dito si muove: la corsa già fatta,
 * partendo da dov'era, tenuta dentro i due estremi.
 *
 * Il taglio ai bordi è quello che dà la sensazione di un foglio vero e non di
 * un elastico: arrivato in cima non cresce oltre il contenuto, arrivato in
 * fondo non scende sotto zero, e il dito può continuare a muoversi senza che
 * accada niente di strano.
 */
export function heightWhileDragging(
  { base, dy, travel }: { base: number; dy: number; travel: number },
): number {
  return Math.min(travel, Math.max(0, base - dy))
}
