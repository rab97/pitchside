import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog } from '@/shared/components/ui/Dialog'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { Select } from '@/shared/components/ui/Select'
import { SortableList } from '@/shared/components/ui/SortableList'
import { fieldKind } from '@/shared/lib/fieldKind'
import { messageForFieldWrite } from '../utils/fieldMessages'
import { sortOrderPatches } from '../utils/reorder'
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
  const { fields, isPending, error, create, update, remove, reorderFields } = useAdminFields()

  // The order shown while a drag's write is in flight or has just failed —
  // `null` means "trust the query", which is where it goes back to the
  // moment a write turns out not to have happened after all.
  const [order, setOrder] = useState<AdminField[] | null>(null)
  const displayFields = order ?? fields

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

  async function handleReorder(next: AdminField[]) {
    // Shown immediately — the drag itself already told the manager where the
    // pitch landed, so the list must not spring back while the write is in
    // flight — but only until we know whether it actually happened.
    setOrder(next)
    const patches = sortOrderPatches(next)
    if (patches.length === 0) return
    try {
      await reorderFields(patches)
    } catch (e) {
      // A wrong order the manager can see and redo is recoverable; a wrong
      // order the screen hides is not. Drop the optimistic view and let the
      // now-invalidated query show what the database actually holds.
      setOrder(null)
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
        ) : error ? null : displayFields.length === 0 ? (
          <p className="p-4 text-[13px] text-muted">
            Nessun campo. Aggiungine uno per cominciare a prendere prenotazioni.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            <SortableList
              items={displayFields}
              onReorder={handleReorder}
              renderItem={(field, handle) => (
                <div className="flex flex-col gap-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <svg
                      ref={handle.ref}
                      {...handle.attributes}
                      {...handle.listeners}
                      aria-label="Riordina"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      viewBox="0 0 20 20"
                      className="h-5 w-5 shrink-0 cursor-grab text-ink-2 active:cursor-grabbing"
                    >
                      <line x1="4" y1="6" x2="16" y2="6" />
                      <line x1="4" y1="10" x2="16" y2="10" />
                      <line x1="4" y1="14" x2="16" y2="14" />
                    </svg>

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
                </div>
              )}
            />
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
