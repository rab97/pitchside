import { createContext, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Where a portal-rendered popover — `Select`'s listbox today, a future
 * `Popover` panel tomorrow — should mount while it opens inside a `Dialog`.
 *
 * A native `<dialog>` shown with `showModal()` is promoted to the browser's
 * top layer, painted above everything else regardless of z-index. Anything
 * portalled to `document.body` — the usual default for this kind of popover
 * — ends up a *sibling* of that top-layer dialog, not a descendant of it, so
 * it paints underneath the dialog's own (opaque) box and — more subtly — is
 * excluded from hit-testing and keyboard focus entirely, because the browser
 * treats everything outside the modal dialog's subtree as inert while it is
 * open. The popover still reports itself as open (`data-state`,
 * `aria-expanded`) but nothing on screen can see or reach it.
 *
 * The fix is to portal into the dialog's own node instead: still the top
 * layer, still fully interactive. Any component that portals content and
 * might render inside a `Dialog` should read this context and pass it
 * through as the portal's `container`, falling back to the default
 * (`document.body`, via `undefined`) when it is `null` — i.e. outside any
 * dialog.
 */
export const DialogPortalContext = createContext<HTMLElement | null>(null)

/**
 * Involucro sull'elemento `<dialog>` nativo: da lì arrivano gratis il fuoco
 * intrappolato, la chiusura con Esc e lo sfondo inerte. Non usiamo shadcn/ui
 * perché il suo tema porta con sé un set di token proprio, che entrerebbe in
 * conflitto con quelli dei mockup — che sono la fonte di verità del progetto.
 */
export function Dialog({ open, onClose, labelledBy, size = 'default', children }: {
  open: boolean
  onClose: () => void
  labelledBy?: string
  size?: 'default' | 'wide'
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  // Consumers of DialogPortalContext need a re-render to see the node, and a
  // ref update alone never causes one — hence state, set once the element
  // actually exists (it doesn't yet on the render where `open` first flips
  // to true: the effect below runs after that commit, when `ref.current` is
  // populated, and pushes the node into state).
  const [container, setContainer] = useState<HTMLDialogElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
    setContainer(el)
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
      className={
        'm-auto rounded-card border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/45 '
        + (size === 'wide' ? 'w-[min(640px,calc(100vw-2rem))]' : 'w-[min(420px,calc(100vw-2rem))]')
      }
    >
      <DialogPortalContext.Provider value={container}>
        {children}
      </DialogPortalContext.Provider>
    </dialog>
  )
}
