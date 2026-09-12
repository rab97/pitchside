import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tapTarget } from '@/test/tailwindBox'
import { ProfilePage } from './ProfilePage'
import * as authProvider from '../hooks/AuthProvider'
import * as signOutHook from '../hooks/useSignOut'
import * as emailHook from '../hooks/useUpdateEmail'
import * as googleHook from '../hooks/useLinkGoogle'
import * as tenant from '@/shared/tenant/FacilityProvider'

const facility = {
  id: 'f1', slug: 'palacalcetto', name: 'Palacalcetto', color: '#1f7a3f',
  phone: null, address: null, cancel_hours: 24, booking_horizon_days: 60,
  slot_minutes: 30, min_duration_minutes: 60, features: {},
} as never

function stubHooks() {
  // `MobileFrame` monta la barra alta, che chiede la struttura: senza questo
  // `useFacility` solleva, e nessuna asserzione arriverebbe mai.
  vi.spyOn(tenant, 'useFacility').mockReturnValue(facility)
  vi.spyOn(signOutHook, 'useSignOut').mockReturnValue({
    signOut: vi.fn(), leaving: false, error: null,
  })
  vi.spyOn(emailHook, 'useUpdateEmail').mockReturnValue({
    setEmail: vi.fn(), saving: false, error: null, sent: false,
  })
  vi.spyOn(googleHook, 'useLinkGoogle').mockReturnValue({
    linkGoogle: vi.fn(), linking: false, error: null,
  })
}

function stubSession(user: Record<string, unknown> | null) {
  vi.spyOn(authProvider, 'useAuth').mockReturnValue({
    session: user ? ({ user } as never) : null,
    isAdmin: false,
    loading: false,
  })
}

function renderPage() {
  return render(<MemoryRouter><ProfilePage /></MemoryRouter>)
}

describe('ProfilePage', () => {
  beforeEach(() => { vi.restoreAllMocks(); stubHooks() })

  it('chi non è entrato viene invitato, non respinto', () => {
    stubSession(null)
    renderPage()
    expect(screen.getByRole('link', { name: /accedi/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Esci' })).not.toBeInTheDocument()
  })

  it('mostra il numero con cui si entra', () => {
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()
    expect(screen.getByText(/3331112233/)).toBeInTheDocument()
  })

  it('un indirizzo in attesa è detto in attesa, non come se funzionasse', () => {
    stubSession({
      phone: '393331112233', email: null,
      new_email: 'rossi@example.com', identities: [],
    })
    renderPage()
    expect(screen.getByText(/in attesa di conferma/i)).toBeInTheDocument()
    expect(screen.getByText(/rossi@example.com/)).toBeInTheDocument()
  })

  // `double_confirm_changes = true` in `supabase/config.toml`, e verificato
  // sullo stack: chi ha già un indirizzo confermato e ne chiede un altro
  // riceve DUE messaggi — uno al nuovo indirizzo, uno al vecchio — e il
  // cambio vale solo quando sono stati aperti entrambi i collegamenti. La
  // frase al singolare mandava il cliente ad aprirne uno solo e a tornare qui
  // a rileggere «in attesa di conferma», senza che niente dicesse perché.
  it('con un indirizzo attivo e uno in attesa dice che i collegamenti sono due', () => {
    stubSession({
      phone: '393331112233', email: 'vecchio@example.com',
      new_email: 'nuovo@example.com', identities: [],
    })
    renderPage()

    const avviso = screen.getByRole('status')
    expect(avviso).toHaveTextContent(/in attesa di conferma/i)
    expect(avviso).toHaveTextContent(/nuovo@example.com/)
    expect(avviso).toHaveTextContent(/vecchio@example.com/)
    expect(avviso).toHaveTextContent(/tutti e due i collegamenti/i)

    // E l'indirizzo dell'account, intanto, è ancora il vecchio: è quello che
    // riceve, ed è l'unico che compare fra i dati.
    const account = screen.getByRole('list', { name: 'Dati dell’account' })
    expect(within(account).getByText('vecchio@example.com')).toBeInTheDocument()
    expect(within(account).queryByText('nuovo@example.com')).not.toBeInTheDocument()
  })

  // L'altra metà: senza un indirizzo attivo il messaggio è uno solo, e dire
  // «tutti e due» sarebbe falso nel verso opposto.
  it('senza un indirizzo attivo il collegamento da aprire è uno solo', () => {
    stubSession({
      phone: '393331112233', email: null,
      new_email: 'nuovo@example.com', identities: [],
    })
    renderPage()

    const avviso = screen.getByRole('status')
    expect(avviso).toHaveTextContent(/apri il collegamento che ti abbiamo mandato lì/i)
    expect(avviso).not.toHaveTextContent(/tutti e due/i)
  })

  it('un indirizzo confermato è mostrato senza avvisi', () => {
    stubSession({
      phone: '393331112233', email: 'rossi@example.com', identities: [],
    })
    renderPage()
    expect(screen.getByText(/rossi@example.com/)).toBeInTheDocument()
    expect(screen.queryByText(/in attesa di conferma/i)).not.toBeInTheDocument()
  })

  // Non c'è una riga di codice che mandi posta in questo repository: né
  // funzioni edge, né un modulo di notifiche. Il primo promemoria parte nel
  // sotto-progetto successivo. Una frase al presente — «ti scriviamo qui per
  // le conferme» — è lo stesso difetto di §2.5, spostato da un interruttore
  // alle parole: il prodotto che promette ciò che non fa.
  it('l’indirizzo attivo dice a cosa serve senza promettere posta che nessuno manda', () => {
    stubSession({
      phone: '393331112233', email: 'rossi@example.com', identities: [],
    })
    renderPage()
    expect(screen.getByText(/è qui che ti scriveremo/i)).toBeInTheDocument()
    expect(screen.getByText(/non mandiamo ancora niente/i)).toBeInTheDocument()
  })

  it('senza indirizzo si dice perché serve, non che lo useremmo già', () => {
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()
    expect(screen.getByText(/non abbiamo un indirizzo per te/i)).toBeInTheDocument()
    expect(screen.getByText(/non mandiamo ancora niente/i)).toBeInTheDocument()
  })

  it('offre di collegare Google solo se non è già collegato', () => {
    stubSession({ phone: '393331112233', email: null, identities: [] })
    const { unmount } = renderPage()
    expect(screen.getByRole('button', { name: /collega google/i })).toBeInTheDocument()
    unmount()

    stubSession({
      phone: '393331112233', email: 'rossi@example.com',
      identities: [{ provider: 'google' }],
    })
    renderPage()
    expect(screen.queryByRole('button', { name: /collega google/i })).not.toBeInTheDocument()
  })

  it('l’uscita chiama signOut', async () => {
    const signOut = vi.fn()
    vi.spyOn(signOutHook, 'useSignOut').mockReturnValue({ signOut, leaving: false, error: null })
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()
    screen.getByRole('button', { name: 'Esci' }).click()
    expect(signOut).toHaveBeenCalled()
  })

  it('dice se il salvataggio dell’indirizzo non è riuscito', () => {
    vi.spyOn(emailHook, 'useUpdateEmail').mockReturnValue({
      setEmail: vi.fn(), saving: false, sent: false,
      error: 'Questo indirizzo è già collegato a un altro account. Entra con quello, oppure usane uno diverso.',
    })
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()
    expect(screen.getByText(/già collegato a un altro account/)).toBeInTheDocument()
  })

  // La distinzione fra «la mail è partita» e «l'indirizzo funziona» non si può
  // mettere alla prova dentro `useUpdateEmail`: il gancio è un involucro
  // attorno a una chiamata sola, e quella differenza vive nell'assenza di un
  // cambiamento. Qui invece c'è qualcosa che può cambiare — l'elenco dei dati
  // dell'account — e questa è l'asserzione che impedisce di far collassare
  // «in attesa» in «salvato».
  it('a messaggio partito l’indirizzo non entra fra i dati dell’account', () => {
    vi.spyOn(emailHook, 'useUpdateEmail').mockReturnValue({
      setEmail: vi.fn(), saving: false, error: null, sent: true,
    })
    stubSession({
      phone: '393331112233', email: null,
      new_email: 'rossi@example.com', identities: [],
    })
    renderPage()

    const account = screen.getByRole('list', { name: 'Dati dell’account' })
    // Il numero sì: se questo sparisse, l'asserzione qui sotto passerebbe
    // anche su un elenco vuoto, cioè su nulla.
    expect(within(account).getByText(/3331112233/)).toBeInTheDocument()
    expect(within(account).queryByText(/rossi@example.com/)).not.toBeInTheDocument()
    expect(screen.getByText(/in attesa di conferma/i)).toBeInTheDocument()
  })

  // Il ramo normale subito dopo il clic su «Salva»: `updateUser` ha mandato
  // la mail, ma `session.user.new_email` è ancora vecchio finché
  // `USER_UPDATED` non arriva. È qui che la frase sbagliata — «indirizzo
  // salvato» — verrebbe naturale a chiunque tocchi questo file, e finché
  // nessuno apre il collegamento quella frase è falsa.
  it('a messaggio partito si dice che è partito, non che è salvato', () => {
    vi.spyOn(emailHook, 'useUpdateEmail').mockReturnValue({
      setEmail: vi.fn(), saving: false, error: null, sent: true,
    })
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()

    const avviso = screen.getByRole('status')
    expect(avviso).toHaveTextContent(/ti abbiamo mandato un messaggio/i)
    expect(avviso).toHaveTextContent(/apri il collegamento/i)
    // Le due frasi che qui sarebbero una bugia: quella del salvataggio e
    // quella dello stato attivo.
    expect(screen.queryByText(/salvat/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/è qui che ti scriveremo/i)).not.toBeInTheDocument()

    // E l'account, intanto, non ha nessun indirizzo.
    const account = screen.getByRole('list', { name: 'Dati dell’account' })
    expect(within(account).queryByText(/@/)).not.toBeInTheDocument()
  })

  // Il gesto che attraversa il ponte di §2.2: senza questo, il campo e il
  // pulsante potrebbero sparire del tutto e gli altri test passerebbero.
  it('l’indirizzo scritto nel campo arriva a setEmail', () => {
    const setEmail = vi.fn()
    vi.spyOn(emailHook, 'useUpdateEmail').mockReturnValue({
      setEmail, saving: false, error: null, sent: false,
    })
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()

    fireEvent.change(screen.getByLabelText(/indirizzo email/i), {
      target: { value: 'rossi@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))

    expect(setEmail).toHaveBeenCalledWith('rossi@example.com')
  })

  it('il pulsante di Google chiama linkGoogle', () => {
    const linkGoogle = vi.fn()
    vi.spyOn(googleHook, 'useLinkGoogle').mockReturnValue({
      linkGoogle, linking: false, error: null,
    })
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()

    screen.getByRole('button', { name: 'Collega Google' }).click()

    expect(linkGoogle).toHaveBeenCalled()
  })

  // `ensure_my_member` crea la scheda anche senza numero confermato, e Google
  // è la strada che `LoginPage` spinge a prendere: un cliente che entra solo
  // da lì è un cliente a tutti gli effetti e non ha un telefono. Per lui la
  // sezione «Come entri» diceva tre cose false in fila — una riga «Telefono»
  // vuota, la frase sulla chiave, e nessuna traccia di Google.
  it('chi entra solo con Google non ha un telefono, e non glielo inventiamo', () => {
    stubSession({
      phone: null, email: 'rossi@example.com',
      identities: [{ provider: 'google' }],
    })
    renderPage()

    const account = screen.getByRole('list', { name: 'Dati dell’account' })
    expect(within(account).queryByText('Telefono')).not.toBeInTheDocument()
    expect(screen.queryByText(/il numero è la tua chiave/i)).not.toBeInTheDocument()
    // E la strada da cui entra davvero è nominata: `GoogleSection` si
    // nasconde proprio quando l'identità c'è già, quindi senza questa riga
    // la schermata non direbbe da nessuna parte come fa a entrare.
    expect(within(account).getByText('Google')).toBeInTheDocument()
  })
})

// spec §2.4: «bersagli non più piccoli di quelli della barra dei tab».
const FLOOR = 44

const CONTROLS: [string, () => Element][] = [
  ['Il campo dell’indirizzo', () => screen.getByLabelText(/indirizzo email/i)],
  ['Salva', () => screen.getByRole('button', { name: 'Salva' })],
  ['Collega Google', () => screen.getByRole('button', { name: 'Collega Google' })],
  ['Esci', () => screen.getByRole('button', { name: 'Esci' })],
]

/**
 * Le misure escono da una compilazione vera di Tailwind sulle classi che
 * l'elemento porta davvero (`src/test/tailwindBox.ts`): jsdom non impagina e
 * butta via le regole `@media`, che è esattamente il ramo dove vivono le
 * utility `pointer-coarse:`.
 *
 * Due cose che il lettore non deve dedurre da sé.
 *
 * Sull'asse orizzontale la risposta è `null` per tutti e quattro: qui i
 * comandi sono `w-full` dentro una colonna, quindi la larghezza è quella
 * della scheda e nessuna utility la dichiara. Si asserisce esplicitamente,
 * perché `null` vuol dire «Tailwind non dichiara niente su quell'asse», mai
 * «il bersaglio non ha un minimo»: letto nel secondo modo trasformerebbe una
 * classe invisibile a questo strumento in un test che passa.
 *
 * Sul campo di testo i 44 arrivano tutti da `min-h-11`. `tailwindBox`
 * compila `@import "tailwindcss"` e non `src/index.css`, quindi i 36px che
 * `.field` dichiara lì non li vede: il numero resta comunque quello che
 * dipinge un browser, perché `min-height` vince su `height`.
 */
describe('ProfilePage — i bersagli sotto il pollice', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    stubHooks()
    stubSession({ phone: '393331112233', email: null, identities: [] })
  })

  it.each(CONTROLS)('«%s» arriva a 44 in altezza su un telefono', async (_name, find) => {
    renderPage()

    const { width, height } = await tapTarget(find(), 'coarse')

    expect(height).toEqual(expect.any(Number))
    expect(height).toBeGreaterThanOrEqual(FLOOR)
    expect(width).toBeNull()
  })

  it('con un mouse non cresce niente', async () => {
    renderPage()

    // L'altra metà della scelta: `pointer-coarse:` ingrandisce dove tocca un
    // dito e lascia stare il resto. Se questo diventasse 44, la variante è
    // stata sostituita da qualcosa di incondizionato.
    expect(await tapTarget(screen.getByRole('button', { name: 'Esci' }), 'fine'))
      .toEqual({ width: null, height: null })
  })
})
