/**
 * Costanti delle rotte dell'app.
 *
 * La rotta di accesso è estratta come costante per evitare che i confronti
 * di pathname si scrivano con letterali string in più punti: se la rotta
 * viene rinominata qui, tutti gli utilizzi si sincronizzano automaticamente
 * e il comportamento rimane coerente in tutta l'app.
 */

export const LOGIN_ROUTE = '/accedi'
