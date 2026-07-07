import { Circle, ArrowsClockwise, CheckCircle, LockSimple } from '@phosphor-icons/react'

export const STATUS_META = {
  open: {
    label: 'Open',
    icon: Circle,
    className: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/30',
  },
  in_progress: {
    label: 'In progress',
    icon: ArrowsClockwise,
    className:
      'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30',
  },
  resolved: {
    label: 'Resolved',
    icon: CheckCircle,
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
  },
  closed: {
    label: 'Closed',
    icon: LockSimple,
    className:
      'bg-stone-100 text-stone-600 ring-stone-500/20 dark:bg-stone-500/10 dark:text-stone-400 dark:ring-stone-500/30',
  },
}

export default function StatusBadge({ status, size = 'md' }) {
  const meta = STATUS_META[status] ?? STATUS_META.open
  const Icon = meta.icon
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-xs gap-1.5'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset ${sizeClasses} ${meta.className}`}
    >
      <Icon size={size === 'sm' ? 11 : 12} weight="fill" />
      {meta.label}
    </span>
  )
}
