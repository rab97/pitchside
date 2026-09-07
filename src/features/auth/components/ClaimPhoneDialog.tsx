import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/shared/components/ui/Dialog'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { toE164 } from './LoginPage'

type Step = 'phone' | 'code' | 'done'

/**
 * Chi entra con Google non ha mai dato un numero: senza, non c'è modo di
 * ritrovare le schede che il gestore ha creato al telefono negli anni. Si
 * apre dopo il primo accesso, quando `session.user.phone` è vuoto, e chiede
 * il numero solo per verificarlo — la rivendicazione vera e propria non
 * accetta parametri, legge il numero da dove l'ha scritto Supabase.
 */
export function ClaimPhoneDialog() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [dismissed, setDismissed] = useState(false)
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [claimedCount, setClaimedCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = !!session && !session.user.phone && !dismissed

  function close() {
    setDismissed(true)
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
    const { data, error: claimError } = await supabase.rpc('claim_members_by_verified_phone')
    setBusy(false)
    if (claimError) {
      setError('Il numero è verificato, ma non siamo riusciti a recuperare lo storico.')
      return
    }

    qc.invalidateQueries({ queryKey: ['my-member'] })

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
  'text-white transition disabled:opacity-50'

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="rounded-lg border border-terra bg-terra-tint px-3 py-2 text-[12.5px] text-terra">
      {error}
    </p>
  )
}

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
      <ErrorNote error={error} />
      <button className={buttonClass} type="submit" disabled={busy || phone.replace(/\D/g, '').length < 9}>
        {busy ? 'Invio…' : 'Mandami il codice'}
      </button>
      <button type="button" className="text-[12.5px] text-muted underline" onClick={onSkip}>
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
        <button type="button" className="text-pitch underline" onClick={onBack}>
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

      <ErrorNote error={error} />
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
