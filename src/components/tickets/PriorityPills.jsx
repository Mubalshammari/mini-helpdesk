import { PRIORITIES } from '../../lib/constants'
import { PRIORITY_META } from '../ui/PriorityIcon'

const PILL_COLORS = {
  low: {
    active: 'bg-stone-400 text-white shadow-sm dark:bg-stone-500',
    idle: 'text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-700/60',
  },
  medium: {
    active: 'bg-stone-600 text-white shadow-sm',
    idle: 'text-stone-600 hover:bg-stone-200/60 dark:text-stone-300 dark:hover:bg-stone-700/60',
  },
  high: {
    active: 'bg-orange-500 text-white shadow-sm',
    idle: 'text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-500/10',
  },
  urgent: {
    active: 'bg-rose-500 text-white shadow-sm',
    idle: 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10',
  },
}

// Staff-only quick priority control - same segmented-pill pattern as
// StatusPills, one size down, since priority is the secondary action here.
export default function PriorityPills({ priority, onSelect }) {
  return (
    <div
      role="group"
      aria-label="Ticket priority"
      className="inline-flex flex-wrap items-center gap-0.5 rounded-full bg-stone-100 p-0.5 dark:bg-stone-900"
    >
      {PRIORITIES.map((p) => {
        const isActive = p === priority
        const colors = PILL_COLORS[p]
        return (
          <button
            key={`${p}-${isActive}`}
            type="button"
            onClick={() => !isActive && onSelect(p)}
            aria-pressed={isActive}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-300 ${
              isActive ? `${colors.active} animate-pill-pop cursor-default` : `${colors.idle} active:scale-95`
            }`}
          >
            {PRIORITY_META[p].label}
          </button>
        )
      })}
    </div>
  )
}
