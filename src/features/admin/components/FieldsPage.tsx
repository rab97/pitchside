import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog } from '@/shared/components/ui/Dialog'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { Select } from '@/shared/components/ui/Select'
import { fieldKind } from '@/shared/lib/fieldKind'
import { messageForFieldWrite } from '../utils/fieldMessages'
import { useAdminFields, type AdminField } from '../hooks/useAdminFields'
import { SettingsPage } from './SettingsPage'

const KIND_OPTIONS = [
  { value: 'calcio5', label: 'Calcio a 5' },
  { value: 'calcio7', label: 'Calcio a 7' },
  { value: 'calcio11', label: 'Calcio a 11' },
]

type FieldFormValues = { name: string; kind: string; surface: string; covered: boolean }

const EMPTY_FORM: FieldFormValues = { name: '', kind: 'calcio5', surface: 'sintetico', covered: false }

type FormTarget = { mode: 'create' } | { mode: 'edit'; field: AdminField }

/**
 * The manager's pitch list: add, reorder, edit, deactivate and — only for a
 * pitch nobody has ever booked — delete. `bookings.field_id` is `on delete
 * restrict`, so deleting a booked pitch always fails; the point of this
 * screen is to offer deactivation instead, and to explain the failure in
 * words a manager can act on when it happens anyway.
 */
export function FieldsPage() {
  const { fields, isPending, error, create, update, remove } = useAdminFields()

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)
  const [form, setForm] = useState<FieldFormValues>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [deactivating, setDeactivating] = useState<AdminField | null>(null)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormTarget({ mode: 'create' })
  }

  function openEdit(field: AdminField) {
    setForm({ name: field.name, kind: field.kind, surface: field.surface, covered: field.covered })
    setFormError(null)
    setFormTarget({ mode: 'edit', field })
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault()
    if (!formTarget) return
    setFormError(null)
    setSaving(true)
    try {
      const patch = {
        name: form.name.trim(),
        kind: form.kind,
        surface: form.surface.trim(),
        covered: form.covered,
      }
      if (formTarget.mode === 'create') {
        // Not `fields.length`: the seed numbers its pitches from 1 and the
        // column defaults to 0, so counting rows collides with whichever
        // pitch already holds that number — and the two ties in whatever
        // order Postgres returns them.
        const nextSortOrder = fields.reduce((max, f) => Math.max(max, f.sort_order), 0) + 1
        await create({ ...patch, active: true, sort_order: nextSortOrder })
        toast.success('Campo aggiunto.')
      } else {
        await update(formTarget.field.id, patch)
        toast.success('Campo aggiornato.')
      }
      setFormTarget(null)
    } catch (e) {
      setFormError(messageForFieldWrite(e))
    } finally {
      setSaving(false)
    }
  }

  function toggleActive(field: AdminField) {
    // Deactivating a pitch that has bookings does not touch them — they stay
    // valid — but the manager should not learn that by accident, so this
    // case opens a warning dialog rather than flipping the switch outright.
    if (field.active && field.booking_count > 0) {
      setDeactivateError(null)
      setDeactivating(field)
      return
    }
    update(field.id, { active: !field.active }).catch((e) => {
      toast.error(messageForFieldWrite(e))
    })
  }

  async function confirmDeactivate() {
    if (!deactivating) return
    setConfirmingDeactivate(true)
    try {
      await update(deactivating.id, { active: false })
      setDeactivating(null)
    } catch (e) {
      setDeactivateError(messageForFieldWrite(e))
    } finally {
      setConfirmingDeactivate(false)
    }
  }

  async function moveField(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= fields.length) return
    const a = fields[index]
    const b = fields[targetIndex]
    try {
      await update(a.id, { sort_order: b.sort_order })
      await update(b.id, { sort_order: a.sort_order })
    } catch (e) {
      toast.error(messageForFieldWrite(e))
    }
  }

  async function handleDelete(field: AdminField) {
    setDeleteError(null)
    try {
      await remove(field.id)
      toast.success('Campo eliminato.')
      setConfirmingDeleteId(null)
    } catch (e) {
      // The read that decided the button was shown and the click that fired
      // this can straddle a booking created in between — the database still
      // refuses, and the manager needs to hear why, not see a raw error.
      setDeleteError(messageForFieldWrite(e))
    }
  }

  return (
    <SettingsPage title="Campi">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="rounded-[7px] bg-pitch px-3 py-1.5 text-[12.5px] font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
        >
          Aggiungi campo
        </button>
      </div>

      <ErrorNote message={error ? 'Non siamo riusciti a caricare i campi. Riprova.' : null} />

      <div className="rounded-card border border-line bg-surface shadow-card">
        {isPending ? (
          <p className="p-4 text-[13px] text-muted">Carico…</p>
        ) : error ? null : fields.length === 0 ? (
          <p className="p-4 text-[13px] text-muted">
            Nessun campo. Aggiungine uno per cominciare a prendere prenotazioni.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {fields.map((field, index) => (
              <li key={field.id} className="flex flex-col gap-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      aria-label={`Sposta ${field.name} su`}
                      disabled={index === 0}
                      onClick={() => moveField(index, -1)}
                      className="grid h-5 w-5 place-items-center rounded-[5px] border border-line text-[10px] leading-none text-ink-2 hover:border-pitch hover:text-pitch"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label={`Sposta ${field.name} giù`}
                      disabled={index === fields.length - 1}
                      onClick={() => moveField(index, 1)}
                      className="grid h-5 w-5 place-items-center rounded-[5px] border border-line text-[10px] leading-none text-ink-2 hover:border-pitch hover:text-pitch"
                    >
                      ▼
                    </button>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-ink">{field.name}</span>
                      {!field.active && (
                        <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                          disattivato
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] text-muted">
                      {fieldKind(field.kind)} · {field.surface} · {field.covered ? 'coperto' : 'scoperto'}
                    </span>
                  </div>

                  <label className="flex items-center gap-1.5 text-[12px] text-ink-2">
                    <input
                      type="checkbox"
                      checked={field.active}
                      onChange={() => toggleActive(field)}
                      className="h-[15px] w-[15px] accent-pitch"
                    />
                    Attivo
                  </label>

                  <button
                    type="button"
                    onClick={() => openEdit(field)}
                    className="rounded-[7px] border border-line px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
                  >
                    Modifica
                  </button>

                  {field.booking_count === 0 && (
                    confirmingDeleteId === field.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          className="rounded-[7px] border border-line px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
                        >
                          Annulla
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(field)}
                          className="rounded-[7px] border border-terra px-2.5 py-1 text-[12px] text-terra transition-colors hover:bg-terra-tint"
                        >
                          Conferma
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setDeleteError(null); setConfirmingDeleteId(field.id) }}
                        className="rounded-[7px] border border-line px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-terra hover:text-terra"
                      >
                        Elimina
                      </button>
                    )
                  )}
                </div>

                {confirmingDeleteId === field.id && (
                  <ErrorNote message={deleteError} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!formTarget} onClose={() => setFormTarget(null)} labelledBy="field-form-title">
        <form className="flex flex-col gap-3 p-4" onSubmit={submitForm}>
          <h3 id="field-form-title" className="text-base font-semibold tracking-[-.01em]">
            {formTarget?.mode === 'edit' ? 'Modifica campo' : 'Nuovo campo'}
          </h3>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[.06em] text-muted">Nome</span>
            <input
              className="field"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[.06em] text-muted">Tipo</span>
            <Select
              value={form.kind}
              onChange={(kind) => setForm((f) => ({ ...f, kind }))}
              options={KIND_OPTIONS}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[.06em] text-muted">Superficie</span>
            <input
              className="field"
              value={form.surface}
              onChange={(e) => setForm((f) => ({ ...f, surface: e.target.value }))}
              required
            />
          </label>

          <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
            <input
              type="checkbox"
              checked={form.covered}
              onChange={(e) => setForm((f) => ({ ...f, covered: e.target.checked }))}
              className="h-[15px] w-[15px] accent-pitch"
            />
            Coperto
          </label>

          {formTarget?.mode === 'edit' && (
            <Link
              to={`/admin/tariffe?campo=${formTarget.field.id}`}
              className="text-[13px] font-medium text-pitch underline transition-colors hover:text-pitch-strong"
            >
              Aggiorna le tariffe di questo campo →
            </Link>
          )}

          <ErrorNote message={formError} />

          <div className="flex justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => setFormTarget(null)}
              className="rounded-[7px] border border-line px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[7px] bg-pitch px-3 py-1.5 text-[12.5px] font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
            >
              {saving ? 'Salvo…' : 'Salva'}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!deactivating} onClose={() => setDeactivating(null)} labelledBy="deactivate-title">
        <div className="flex flex-col gap-3 p-4">
          <h3 id="deactivate-title" className="text-base font-semibold tracking-[-.01em]">
            Disattivare {deactivating?.name}?
          </h3>
          {deactivating && (
            <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
              Questo campo ha {deactivating.booking_count} prenotazioni: resteranno valide.
              Per chiudere davvero il campo usa le{' '}
              <Link to="/admin/chiusure" className="text-pitch underline">Chiusure</Link>.
            </p>
          )}
          <ErrorNote message={deactivateError} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeactivating(null)}
              className="rounded-[7px] border border-line px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={confirmingDeactivate}
              onClick={confirmDeactivate}
              className="rounded-[7px] bg-pitch px-3 py-1.5 text-[12.5px] font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
            >
              {confirmingDeactivate ? 'Disattivo…' : 'Disattiva'}
            </button>
          </div>
        </div>
      </Dialog>
    </SettingsPage>
  )
}
