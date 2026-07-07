import { Circle, ArrowsClockwise, CheckCircle, CalendarBlank } from '@phosphor-icons/react'

const CARDS = [
  { key: 'open', label: 'Open', icon: Circle, iconClass: 'text-sky-500' },
  { key: 'inProgress', label: 'In progress', icon: ArrowsClockwise, iconClass: 'text-amber-500' },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle, iconClass: 'text-emerald-500' },
  { key: 'today', label: 'Opened today', icon: CalendarBlank, iconClass: 'text-indigo-500' },
]

export default function StatsCards({ stats, loading }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => {
        const CardIcon = card.icon
        return (
          <div
            key={card.key}
            className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500 dark:text-stone-400">{card.label}</span>
              <CardIcon size={16} weight="regular" className={card.iconClass} />
            </div>
            {loading ? (
              <div className="mt-2 h-7 w-10 animate-pulse rounded-md bg-stone-200 dark:bg-stone-700" />
            ) : (
              <p className="mt-1 text-2xl font-semibold text-stone-900 dark:text-stone-100">{stats[card.key]}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
