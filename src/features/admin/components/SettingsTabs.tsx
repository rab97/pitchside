import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/admin/campi', label: 'Campi' },
  { to: '/admin/tariffe', label: 'Tariffe' },
  { to: '/admin/chiusure', label: 'Chiusure' },
  { to: '/admin/struttura', label: 'Struttura' },
]

/**
 * The settings sections. The day grid link comes first and is not a tab: it
 * leaves this area rather than moving inside it, and a manager who came here
 * to change one price needs the way back to be obvious.
 */
export function SettingsTabs() {
  const { pathname } = useLocation()

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link
        to="/admin"
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
      >
        <span aria-hidden>‹ </span>Giornata
      </Link>
      <span aria-hidden className="mx-1 h-5 w-px bg-line" />
      {TABS.map((tab) => {
        const active = pathname === tab.to
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={
              'rounded-lg border px-3 py-1.5 text-[13px] transition-colors ' +
              (active
                ? 'border-pitch bg-pitch-tint font-medium text-pitch'
                : 'border-line bg-surface text-ink-2 hover:border-pitch hover:text-pitch')
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
