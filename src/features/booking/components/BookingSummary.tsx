import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { formatEuro } from '@/shared/lib/money'
import type { FieldRow } from '@/shared/hooks/useFields'
import { fieldKind } from '../utils/fieldKind'
import { durationLabel } from '../utils/durationLabel'

/**
 * Le righe del riepilogo — campo, durata, totale — e la nota sul pagamento.
 *
 * Stanno in un file a parte perché lo stesso riepilogo si mostra in due
 * posti: la card a fianco dell'elenco da `lg` in su, e il foglio aperto in
 * basso su telefono. Non è la stessa cornice (una ha un'intestazione e vive
 * in colonna, l'altro si apre e si chiude), ma il contenuto deve essere
 * identico: se divergesse, uno dei due direbbe al cliente un prezzo o una
 * scadenza che l'altro smentisce.
 *
 * Qui non c'è il pulsante «Conferma». Il gesto di confermare resta di
 * `BookPage`, che sa se serve prima l'accesso, e viene passato alle due
 * cornici: la logica sta in un posto, il vestito in due.
 */
export function SummaryRows({ field, minutes, price }: {
  field: FieldRow
  minutes: number
  price: number | null
}) {
  return (
    <dl className="flex flex-col gap-1.5 text-[13px]">
      <div className="flex justify-between">
        <dt className="text-muted">Campo</dt>
        <dd className="font-medium">
          {field.name} · {fieldKind(field.kind)}
        </dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">Durata</dt>
        <dd className="tabular-nums font-medium">{durationLabel(minutes)}</dd>
      </div>
      <div className="flex justify-between border-t border-line-soft pt-1.5">
        <dt className="text-muted">Totale</dt>
        <dd className="tabular-nums font-semibold">
          {price != null ? formatEuro(price) : '—'}
        </dd>
      </div>
    </dl>
  )
}

/**
 * Dove si paga e fino a quando si può disdire gratis. La scadenza è la stessa
 * che il database userà per decidere se la disdetta è in ritardo: si dice
 * prima di confermare, non dopo.
 */
export function CancelNote({ cancelDeadline }: { cancelDeadline: Date | null }) {
  return (
    <p className="text-[11.5px] leading-[1.5] text-muted">
      Si paga in struttura.
      {cancelDeadline
        ? ` Puoi disdire gratis fino a ${format(cancelDeadline, 'EEE d MMM', { locale: it })} alle ${format(cancelDeadline, 'HH:mm')}.`
        : ''}
    </p>
  )
}
