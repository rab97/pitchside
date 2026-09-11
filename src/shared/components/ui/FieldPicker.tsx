import { fieldKind } from '@/shared/lib/fieldKind'

/**
 * The fields `FieldPicker` reads off a pitch row. The customer-facing
 * `FieldRow` and the manager's `AdminField` both carry these, plus more of
 * their own, so either satisfies this type without adaptation.
 */
export type PickableField = {
  id: string
  name: string
  kind: string
  covered: boolean
}

/**
 * The pitch selector, shared by the customer booking screen and the
 * manager's price-bands screen: both hand a facility's pitches to the user
 * as a row of choices, styled the same way. Moved here from
 * `features/booking/components/BookPage.tsx` once a second feature needed
 * it — a feature does not import another feature's components, so what two
 * areas need moves to `shared/`.
 */
export function FieldPicker<T extends PickableField>({ fields, selected, onSelect }: {
  fields: T[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f) => {
        const isSelected = f.id === selected
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(f.id)}
            className={
              'rounded-lg border px-3 py-2 text-left transition ' +
              (isSelected
                ? 'border-pitch bg-pitch-tint text-pitch'
                : 'border-line bg-surface text-ink-2 hover:border-pitch')
            }
          >
            <span className="block text-[13px] font-medium">{f.name}</span>
            <span className="block text-[10.5px] text-muted">
              {fieldKind(f.kind)} · {f.covered ? 'coperto' : 'scoperto'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
