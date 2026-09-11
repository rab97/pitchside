import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/shared/components/ui/Dialog'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { toE164 } from './LoginPage'

type Step = 'phone' | 'code' | 'done'

/**
 * Il telefono e il ricongiungimento dello storico, per tutte le rotte
 * cliente: è `App` a montarlo, una volta, dentro i provider e fuori dalle
 * rotte, perché la domanda vale su qualunque schermata (spec 1B §2.2, §5.4).
 *
 * I due percorsi d'accesso arrivano qui in stati diversi:
 *
 * - **Google**: nessun numero. Si chiede, si verifica con un SMS, e solo dopo
 *   si rivendica — la funzione del database legge il numero dal token, non da
 *   questo campo di testo, ed è per quello che non accetta parametri.
 * - **SMS**: il numero è già verificato da prima del primo accesso. Non gli
 *   si chiede niente, ma la rivendicazione non era mai stata fatta per lui:
 *   parte da sé, in silenzio, e il dialogo si apre solo se ha trovato
 *   qualcosa da mostrare.
 */
export function ClaimPhoneDialog() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [claimedCount, setClaimedCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userId = session?.user.id ?? null
  // Solo un numero confermato conta: `phone` senza `phone_confirmed_at` è la
  // verifica a metà di chi ha chiuso la pagina dopo il primo passo, e va
  // richiesto di nuovo. È la stessa condizione che guarda il database.
  const verifiedPhone = session?.user.phone_confirmed_at ? session.user.phone : null
  const dismissed = !!userId && dismissedFor === userId
  const open = !!session && !dismissed && (!verifiedPhone || step === 'code' || step === 'done')

  // La rivendicazione per chi è entrato via SMS. Il `ref` tiene l'utente per
  // cui è già partita: senza, i doppi effetti di StrictMode la chiamerebbero
  // due volte, e ogni cambio di sessione la ripeterebbe. Un errore qui resta
  // silenzioso di proposito — nessuno ha chiesto niente, e un avviso su una
  // schermata che l'utente non ha toccato spaventerebbe senza dire cosa fare;
  // se non ha trovato nulla, il dialogo non si apre nemmeno.
  const claimedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!userId || !verifiedPhone || claimedFor.current === userId) return
    claimedFor.current = userId
    supabase.rpc('claim_members_by_verified_phone').then(({ data, error }) => {
      if (error) return
      qc.invalidateQueries({ queryKey: ['my-member'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      if (data && data.length > 0) {
        setClaimedCount(data.length)
        setStep('done')
      }
    })
  }, [userId, verifiedPhone, qc])

  function close() {
    setDismissedFor(userId)
    setStep('phone')
    setPhone('')
    setCode('')
    setError(null)
  }

  async function sendCode() {
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ phone: toE164(phone) })
    setBusy(false)
    if (error) setError('Non siamo riusciti a mandare il codice. Riprova.')
    else setStep('code')
  }

  async function verify() {
    setError(null)
    setBusy(true)
    const { error: otpError } = await supabase.auth.verifyOtp({
      phone: toE164(phone),
      token: code,
      type: 'phone_change',
    })
    if (otpError) {
      setBusy(false)
      setError('Codice non valido o scaduto.')
      return
    }

    // Solo ora si rivendica: la funzione legge il numero dal token, non da
    // qui, ed è per questo che non prende parametri.
    claimedFor.current = userId
    const { data, error: claimError } = await supabase.rpc('claim_members_by_verified_phone')
    setBusy(false)
    if (claimError) {
      setError('Il numero è verificato, ma non siamo riusciti a recuperare lo storico.')
      return
    }

    qc.invalidateQueries({ queryKey: ['my-member'] })
    qc.invalidateQueries({ queryKey: ['my-bookings'] })

    const count = data?.length ?? 0
    if (count === 0) {
      close()
      return
    }
    setClaimedCount(count)
    setStep('done')
  }

  return (
    <Dialog open={open} onClose={close} labelledBy="claim-phone-title">
      <div className="flex flex-col gap-3.5 p-6">
        {step === 'phone' && (
          <PhoneStep
            phone={phone}
            busy={busy}
            error={error}
            onChange={setPhone}
            onSubmit={sendCode}
            onSkip={close}
          />
        )}
        {step === 'code' && (
          <CodeStep
            phone={phone}
            code={code}
            busy={busy}
            error={error}
            onChange={setCode}
            onSubmit={verify}
            onBack={() => { setStep('phone'); setCode(''); setError(null) }}
          />
        )}
        {step === 'done' && <DoneStep count={claimedCount} onClose={close} />}
      </div>
    </Dialog>
  )
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[15px] ' +
  'text-ink outline-none focus:border-pitch focus:ring-2 focus:ring-pitch/20'

const buttonClass =
  'w-full rounded-lg bg-pitch px-3 py-2.5 text-center text-sm font-medium ' +
  'text-on-pitch transition-colors hover:bg-pitch-strong'

function PhoneStep({ phone, busy, error, onChange, onSubmit, onSkip }: {
  phone: string
  busy: boolean
  error: string | null
  onChange: (v: string) => void
  onSubmit: () => void
  onSkip: () => void
}) {
  return (
    <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <h2 id="claim-phone-title" className="text-[19px] font-semibold tracking-[-.025em]">
        Hai già prenotato al telefono?
      </h2>
      <p className="-mt-1.5 text-[13px] leading-[1.55] text-muted">
        Verifica il tuo numero e ritroviamo le tue prenotazioni passate.
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10.5px] uppercase tracking-[.1em] text-muted">
          Numero di telefono
        </span>
        <input
          className={inputClass}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          autoFocus
          placeholder="347 220 15 63"
          value={phone}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <ErrorNote message={error} />
      <button className={buttonClass} type="submit" disabled={busy || phone.replace(/\D/g, '').length < 9}>
        {busy ? 'Invio…' : 'Mandami il codice'}
      </button>
      <button type="button" className="text-[12.5px] text-muted underline transition-colors hover:text-ink" onClick={onSkip}>
        Non ora
      </button>
    </form>
  )
}

function CodeStep({ phone, code, busy, error, onChange, onSubmit, onBack }: {
  phone: string
  code: string
  busy: boolean
  error: string | null
  onChange: (v: string) => void
  onSubmit: () => void
  onBack: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const digits = code.padEnd(6, ' ').slice(0, 6).split('')

  return (
    <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <h2 id="claim-phone-title" className="text-[19px] font-semibold tracking-[-.025em]">
        Il codice, per favore
      </h2>
      <p className="-mt-1.5 text-[13px] leading-[1.55] text-muted">
        L’abbiamo mandato al {phone}.{' '}
        <button type="button" className="text-pitch underline transition-colors hover:text-pitch-strong" onClick={onBack}>
          Numero sbagliato?
        </button>
      </p>

      <div className="relative">
        <input
          ref={inputRef}
          className="absolute inset-0 h-full w-full opacity-0"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          aria-label="Codice ricevuto via SMS"
          value={code}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <div className="flex gap-2" aria-hidden>
          {digits.map((d, i) => (
            <span
              key={i}
              className={
                'grid aspect-[1/1.15] flex-1 place-items-center rounded-lg border tabular-nums text-[19px] font-medium ' +
                (d.trim()
                  ? 'border-pitch bg-pitch-tint text-pitch'
                  : 'border-line bg-surface-2 text-muted')
              }
            >
              {d.trim() || '–'}
            </span>
          ))}
        </div>
      </div>

      <ErrorNote message={error} />
      <button className={buttonClass} type="submit" disabled={busy || code.length < 6}>
        {busy ? 'Verifica…' : 'Conferma'}
      </button>
    </form>
  )
}

function DoneStep({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-3.5">
      <h2 id="claim-phone-title" className="text-[19px] font-semibold tracking-[-.025em]">
        Bentornato
      </h2>
      <p className="text-[13px] leading-[1.55] text-muted">
        Abbiamo ritrovato le tue prenotazioni: {count} {count === 1 ? 'scheda collegata' : 'schede collegate'}.
      </p>
      <button className={buttonClass} type="button" onClick={onClose}>
        Continua
      </button>
    </div>
  )
}
