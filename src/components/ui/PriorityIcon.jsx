import { CaretDoubleDown, Minus, CaretDoubleUp, Warning } from '@phosphor-icons/react'

export const PRIORITY_META = {
  low: { label: 'Low', icon: CaretDoubleDown, className: 'text-stone-400 dark:text-stone-500' },
  medium: { label: 'Medium', icon: Minus, className: 'text-stone-500 dark:text-stone-400' },
  high: { label: 'High', icon: CaretDoubleUp, className: 'text-orange-500 dark:text-orange-400' },
  urgent: { label: 'Urgent', icon: Warning, className: 'text-rose-500 dark:text-rose-400' },
}

export default function PriorityIcon({ priority, showLabel = true, size = 15 }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.medium
  const Icon = meta.icon

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`} title={meta.label}>
      <Icon size={size} weight="bold" />
      {showLabel && meta.label}
    </span>
  )
}
