import { Link } from 'react-router-dom'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useFields, type FieldRow } from '@/shared/hooks/useFields'
import { useAuth } from '@/features/auth/hooks/AuthProvider'

const KIND_LABELS: Record<string, string> = {
  calcio5: 'Calcio a 5',
  calcio7: 'Calcio a 7',
  calcio11: 'Calcio a 11',
}

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind
}

export function HomePage() {
  const facility = useFacility()
  const fields = useFields()
  const { session } = useAuth()

  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1140px] items-center gap-3 px-4 py-3.5 sm:px-6">
          <div
            className="grid h-8 w-8 place-items-center rounded-full bg-pitch text-sm font-semibold text-white"
            aria-hidden
          >
            {facility.name.charAt(0)}
          </div>
          <span className="text-[15px] font-semibold tracking-[-.01em]">
            {facility.name}
          </span>
          <Link
            className="ml-auto text-[13.5px] font-medium text-pitch underline"
            to={session ? '/prenotazioni' : '/accedi'}
          >
            {session ? 'Le mie prenotazioni' : 'Accedi'}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1140px] px-4 py-10 sm:px-6">
        <p className="tabular-nums text-[11px] uppercase tracking-[.14em] text-pitch">
          Prenota Campi
        </p>
        <h1 className="mt-2 max-w-[24ch] text-3xl font-bold tracking-tight sm:text-4xl">
          {facility.name}
        </h1>
        <p className="mt-2 max-w-[60ch] text-ink-2">
          {facility.address}
          {facility.address && facility.phone ? ' · ' : ''}
          {facility.phone}
        </p>

        <Link
          to="/prenota"
          className="mt-6 inline-block rounded-lg bg-pitch px-5 py-2.5 text-sm font-medium text-white transition"
        >
          Prenota un campo →
        </Link>

        <section className="mt-10">
          <h2 className="text-[13px] font-medium uppercase tracking-[.08em] text-muted">
            I campi
          </h2>
          {fields.length === 0 ? (
            <p className="mt-3 text-ink-2">Nessun campo disponibile al momento.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((field) => (
                <FieldCard key={field.id} field={field} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

function FieldCard({ field }: { field: FieldRow }) {
  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="font-medium">{field.name}</p>
      <p className="mt-1 text-[13px] text-ink-2">
        {kindLabel(field.kind)} · {field.covered ? 'coperto' : 'scoperto'}
      </p>
    </li>
  )
}
