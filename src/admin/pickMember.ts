export type MemberCandidate = { id: string; name: string; phone: string | null }

const digitsOf = (s: string) => s.replace(/\D/g, '')

/**
 * Decide se una telefonata appartiene a una scheda che esiste già.
 *
 * Il telefono, quando c'è, decide da solo: è l'identità del prodotto.
 * Senza telefono ci si affida al nome, ma solo se la corrispondenza è unica —
 * con due «Bianchi» in archivio nessuno può sapere quale sia, e indovinare
 * significherebbe attribuire una prenotazione alla persona sbagliata.
 *
 * Serve perché una prenotazione può fallire *dopo* che la scheda è stata
 * creata (slot occupato nel frattempo): senza questo controllo ogni tentativo
 * lascerebbe un doppione, e i doppioni sono il problema che l'anagrafica
 * unificata esiste per evitare.
 */
export function pickExistingMember(
  rows: MemberCandidate[],
  name: string,
  phone: string,
): string | null {
  const wantedPhone = digitsOf(phone)
  if (wantedPhone) {
    return rows.find((r) => r.phone && digitsOf(r.phone) === wantedPhone)?.id ?? null
  }
  const wantedName = name.trim().toLowerCase()
  if (!wantedName) return null
  const byName = rows.filter((r) => r.name.trim().toLowerCase() === wantedName)
  return byName.length === 1 ? byName[0].id : null
}
