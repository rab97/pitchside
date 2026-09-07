import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Involucro sull'elemento `<dialog>` nativo: da lì arrivano gratis il fuoco
 * intrappolato, la chiusura con Esc e lo sfondo inerte. Non usiamo shadcn/ui
 * perché il suo tema porta con sé un set di token proprio, che entrerebbe in
 * conflitto con quelli dei mockup — che sono la fonte di verità del progetto.
 */
export function Dialog({ open, onClose, labelledBy, children }: {
  open: boolean
  onClose: () => void
  labelledBy?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={onClose}
      // Un clic sullo sfondo chiude: il ::backdrop è il dialog stesso, quindi
      // basta controllare che il bersaglio non sia dentro il riquadro.
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      className="m-auto w-[min(420px,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/45"
    >
      {children}
    </dialog>
  )
}
