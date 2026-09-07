const STORAGE_KEY = 'facility-hostname'

export type ResolveInput = {
  isNative: boolean
  hostname: string
  stored?: string | null
  /**
   * Hostname imposto da fuori, e solo in sviluppo (vedi
   * `resolveTenantHostname`): serve quando l'indirizzo da cui si apre l'app
   * non è uno di quelli registrati in `facility_domains`. Il caso vero è
   * provare dal telefono, dove l'app si raggiunge all'indirizzo di rete
   * della macchina — `192.168.x.y` — che nessuna struttura dichiara, e senza
   * il quale la risoluzione fallisce e la schermata dice, correttamente,
   * «struttura non trovata per questo indirizzo».
   */
  override?: string | null
}

/**
 * Unico punto in cui si decide di quale struttura stiamo parlando.
 * Sul web è l'hostname; l'app nativa gira su capacitor://localhost e non ha
 * un hostname, quindi usa la struttura scelta al primo avvio.
 */
export function hostnameFor(input: ResolveInput): string {
  // Prima di tutto il resto: è una scelta esplicita di chi sviluppa, e vale
  // anche sul nativo, dove serve appunto a saltare la selezione salvata.
  if (input.override) return input.override
  if (!input.isNative) return input.hostname
  if (input.stored) return input.stored
  throw new Error('Nessuna struttura selezionata')
}

export function resolveTenantHostname(): string {
  const isNative = window.location.protocol.startsWith('capacitor')
  return hostnameFor({
    isNative,
    hostname: window.location.hostname,
    stored: localStorage.getItem(STORAGE_KEY),
    // Solo in sviluppo, per costruzione: in produzione `import.meta.env.DEV`
    // è `false` e questo ramo non arriva nemmeno nel pacchetto. Un'app
    // multi-struttura non deve poter essere inchiodata alla struttura
    // sbagliata da una variabile d'ambiente messa male in un deploy.
    override: import.meta.env.DEV ? import.meta.env.VITE_TENANT_HOSTNAME : null,
  })
}

export function storeTenantHostname(slug: string): void {
  localStorage.setItem(STORAGE_KEY, slug)
}
