import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlass } from '@phosphor-icons/react'
import Avatar from '../ui/Avatar'
import StatusBadge, { STATUS_META } from '../ui/StatusBadge'
import PriorityIcon from '../ui/PriorityIcon'
import EmptyState from '../ui/EmptyState'
import { CATEGORIES, CATEGORY_LABELS, STATUSES } from '../../lib/constants'
import { formatDate } from '../../lib/format'

// Read-only queue: the whole row is one click into the ticket, where the
// status/priority pill controls live. The old inline dropdowns are gone on
// purpose - one consistent place to act on a ticket, one click to get there.
export default function TicketsQueueTable({ tickets, loading }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (q && !t.title.toLowerCase().includes(q) && !(t.submitter?.full_name ?? '').toLowerCase().includes(q))
        return false
      return true
    })
  }, [tickets, search, statusFilter, categoryFilter])

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or submitter"
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500 dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-400">
            <tr>
              <th className="px-4 py-3">Submitter</th>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-4 w-full animate-pulse rounded bg-stone-100 dark:bg-stone-700" />
                  </td>
                </tr>
              ))}

            {!loading &&
              filtered.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className="cursor-pointer transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={ticket.submitter?.full_name} size={24} />
                      <span className="whitespace-nowrap text-stone-700 dark:text-stone-300">
                        {ticket.submitter?.full_name || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <span className="line-clamp-1 font-medium text-stone-900 dark:text-stone-100">
                      {ticket.title}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-500 dark:text-stone-400">
                    {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <PriorityIcon priority={ticket.priority} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={ticket.status} size="sm" />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-500 dark:text-stone-400">
                    {formatDate(ticket.created_at)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={MagnifyingGlass}
            title="No tickets match"
            description="Try a different search term or clear the filters."
          />
        )}
      </div>
    </div>
  )
}
