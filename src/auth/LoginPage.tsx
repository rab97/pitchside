import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useFacility } from '../tenant/FacilityProvider'

/**
 * Supabase vuole il numero in E.164. Il gestore digita "347 220 15 63".
 * Esportata perché è la sola regola di normalizzazione del numero in tutta
 * l'app: un secondo posto in cui riscriverla è un secondo posto in cui
 * sbagliarla.
 */
export function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  return digits.startsWith('39') ? `+${digits}` : `+39${digits}`
}

export function LoginPage() {
  const facility = useFacility()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode() {
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) })
    setBusy(false)
    if (error) setError('Non siamo riusciti a mandare il codice. Riprova.')
    else setSent(true)
  }

  async function verify() {
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp(
      { phone: toE164(phone), token: code, type: 'sms' })
    setBusy(false)
    if (error) setError('Codice non valido o scaduto.')
  }

  return (
    <div className="min-h-screen bg-ground p-0 sm:p-6 grid place-items-center">
      <div className="w-full max-w-[880px] overflow-hidden rounded-card border border-line bg-surface shadow-card grid md:grid-cols-[1.05fr_.95fr]">
        <LoginArt name={facility.name} address={facility.address} />
        <div className="flex flex-col justify-center gap-3.5 p-8">
          {sent ? (
            <OtpForm
              phone={phone}
              code={code}
              busy={busy}
              error={error}
              onChange={setCode}
              onSubmit={verify}
              onBack={() => { setSent(false); setCode(''); setError(null) }}
            />
          ) : (
            <PhoneForm
              phone={phone}
              busy={busy}
              error={error}
              onChange={setPhone}
              onSubmit={sendCode}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function LoginArt({ name, address }: { name: string; address: string | null }) {
  return (
    <div className="relative hidden min-h-[280px] flex-col justify-end gap-3 bg-[#081410] p-[34px] md:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#123a26_0%,#081410_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(#0f2e1e,#081410)] before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-white/12 before:content-['']"
      />
      <div className="relative max-w-[15ch] text-[23px] font-semibold leading-tight tracking-[-.03em] text-[#F4F8F3]">
        Il campo ti aspetta.
      </div>
      <div className="relative max-w-[36ch] text-[13px] leading-[1.55] text-[rgba(233,241,232,.7)]">
        {name}{address ? ` · ${address}` : ''}. Prenoti in mezzo minuto e paghi
        in struttura.
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="tabular-nums text-[10.5px] uppercase tracking-[.1em] text-muted">
        {label}
      </span>
      {children}
    </label>
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

function PhoneForm({ phone, busy, error, onChange, onSubmit }: {
  phone: string
  busy: boolean
  error: string | null
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
    >
      <h1 className="text-[21px] font-semibold tracking-[-.025em]">Entra</h1>
      <p className="-mt-1.5 text-[13px] leading-[1.55] text-muted">
        Ti mandiamo un codice via SMS. Se hai già prenotato al telefono,
        ritrovi tutto il tuo storico.
      </p>
      <Field label="Numero di telefono">
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
      </Field>
      <ErrorNote error={error} />
      <button className={buttonClass} type="submit" disabled={busy || phone.replace(/\D/g, '').length < 9}>
        {busy ? 'Invio…' : 'Mandami il codice'}
      </button>
      <p className="text-[11.5px] leading-[1.5] text-muted">
        Il numero serve solo per le conferme di prenotazione: non riceverai
        pubblicità.
      </p>
    </form>
  )
}

function OtpForm({ phone, code, busy, error, onChange, onSubmit, onBack }: {
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
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
    >
      <h1 className="text-[21px] font-semibold tracking-[-.025em]">
        Il codice, per favore
      </h1>
      <p className="-mt-1.5 text-[13px] leading-[1.55] text-muted">
        L’abbiamo mandato al {phone}.{' '}
        <button type="button" className="text-pitch underline" onClick={onBack}>
          Numero sbagliato?
        </button>
      </p>

      {/* Le sei caselle sono decorative: l'input vero è uno solo, così
          incollare il codice dall'SMS funziona come su qualsiasi telefono. */}
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
        <div className="flex gap-2" aria-hidden onClick={() => inputRef.current?.focus()}>
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
        {busy ? 'Verifica…' : 'Entra'}
      </button>
    </form>
  )
}
