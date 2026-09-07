const STORAGE_KEY = 'facility-hostname'

export type ResolveInput = {
  isNative: boolean
  hostname: string
  stored?: string | null
}

/**
 * Unico punto in cui si decide di quale struttura stiamo parlando.
 * Sul web è l'hostname; l'app nativa gira su capacitor://localhost e non ha
 * un hostname, quindi usa la struttura scelta al primo avvio.
 */
export function hostnameFor(input: ResolveInput): string {
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
  })
}

export function storeTenantHostname(slug: string): void {
  localStorage.setItem(STORAGE_KEY, slug)
}
