// Orario di apertura del Palacalcetto. In fase 1B arriva dalla struttura:
// oggi non esiste ancora una colonna che lo dica. Vive in shared/ perché sia
// la griglia del gestore sia la schermata di prenotazione del cliente ne
// hanno bisogno: due aree, una sola fonte.
export const OPEN_MIN = 15 * 60   // 15:00
export const CLOSE_MIN = 24 * 60  // 24:00
export const STEP = 30
