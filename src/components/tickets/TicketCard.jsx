import { Link } from 'react-router-dom'
import StatusBadge from '../ui/StatusBadge'
import PriorityIcon from '../ui/PriorityIcon'
import { CATEGORY_LABELS } from '../../lib/constants'
import { formatDate } from '../../lib/format'

export default function TicketCard({ ticket }) {
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="block rounded-xl border border-stone-200 bg-white p-4 transition-all hover:border-stone-300 hover:shadow-md hover:shadow-stone-900/5 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-stone-900 dark:text-stone-100">{ticket.title}</h3>
        <StatusBadge status={ticket.status} size="sm" />
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-stone-500 dark:text-stone-400">{ticket.description}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-400 dark:text-stone-500">
        <span>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
        <PriorityIcon priority={ticket.priority} size={13} />
        <span>{formatDate(ticket.created_at)}</span>
      </div>
    </Link>
  )
}
