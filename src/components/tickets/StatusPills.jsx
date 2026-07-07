import { STATUSES } from '../../lib/constants'
import { STATUS_META } from '../ui/StatusBadge'

// Spec colors: open=blue, in_progress=amber, resolved=green, closed=gray -
// the same hues StatusBadge already uses, so the pills and the badges never
// disagree about what a status looks like.
const PILL_COLORS = {
  open: {
    active: 'bg-sky-500 text-white shadow-sm',
    idle: 'text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10',
  },
  in_progress: {
    active: 'bg-amber-500 text-white shadow-sm',
    idle: 'text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10',
  },
  resolved: {
    active: 'bg-emerald-500 text-white shadow-sm',
    idle: 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10',
  },
  closed: {
    active: 'bg-stone-500 text-white shadow-sm dark:bg-stone-600',
    idle: 'text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-700/60',
  },
}

// Segmented status control. For staff, clicking an inactive pill calls
// onSelect (the caller opens a confirm dialog before anything changes).
// For everyone else it renders the same pills read-only, so the status
// display looks identical across roles - only the affordance differs.
export default function StatusPills({ status, onSelect, readOnly = false }) {
  return (
    <div
      role="group"
      aria-label="Ticket status"
      className="inline-flex flex-wrap items-center gap-1 rounded-full bg-stone-100 p-1 dark:bg-stone-900"
    >
      {STATUSES.map((s) => {
        const isActive = s === status
        const colors = PILL_COLORS[s]
        const base = `rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
          isActive ? colors.active : colors.idle
        }`

        if (readOnly) {
          return (
            <span key={s} aria-current={isActive || undefined} className={`${base} ${isActive ? '' : 'opacity-50'}`}>
              {STATUS_META[s].label}
            </span>
          )
        }

        return (
          // Keying on active-ness remounts the newly-active pill, which
          // replays the pop animation exactly once per status change.
          <button
            key={`${s}-${isActive}`}
            type="button"
            onClick={() => !isActive && onSelect(s)}
            aria-pressed={isActive}
            className={`${base} ${isActive ? 'animate-pill-pop cursor-default' : 'active:scale-95'}`}
          >
            {STATUS_META[s].label}
          </button>
        )
      })}
    </div>
  )
}
