import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MagnifyingGlass, ArrowRight } from '@phosphor-icons/react'
import Avatar from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import { formatDateTime } from '../../lib/format'

const ACTION_LABELS = {
  status_changed: 'Status changed',
  priority_changed: 'Priority changed',
  title_changed: 'Title edited',
  description_changed: 'Description edited',
}

function actionLabel(action) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ')
}

function formatValue(value) {
  if (value === null || value === undefined) return '—'
  const text = String(value)
  return text.length > 60 ? `${text.slice(0, 60)}…` : text
}

export default function AuditLogTable({ entries, loading, rowLimit }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        (e.ticket?.title ?? '').toLowerCase().includes(q) ||
        (e.actor?.full_name ?? '').toLowerCase().includes(q) ||
        actionLabel(e.action).toLowerCase().includes(q)
    )
  }, [entries, search])

  return (
    <div>
      <div className="relative">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ticket, admin, or action"
          className="w-full max-w-sm rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
        />
      </div>

      {entries.length >= rowLimit && (
        <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
          Showing the most recent {rowLimit} changes.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />
          ))}

        {!loading &&
          filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-2 rounded-lg border border-stone-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-stone-700"
            >
              <div className="flex items-center gap-3">
                <Avatar name={entry.actor?.full_name} size={28} />
                <div className="min-w-0">
                  <p className="text-sm text-stone-700 dark:text-stone-300">
                    <span className="font-medium text-stone-900 dark:text-stone-100">
                      {entry.actor?.full_name || 'Removed admin'}
                    </span>{' '}
                    {actionLabel(entry.action).toLowerCase()} on{' '}
                    <Link
                      to={`/tickets/${entry.ticket_id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      {entry.ticket?.title || 'a ticket'}
                    </Link>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
                    <span className="rounded bg-stone-100 px-1 py-0.5 font-mono dark:bg-stone-700">
                      {formatValue(entry.old_value)}
                    </span>
                    <ArrowRight size={11} weight="bold" />
                    <span className="rounded bg-stone-100 px-1 py-0.5 font-mono dark:bg-stone-700">
                      {formatValue(entry.new_value)}
                    </span>
                  </p>
                </div>
              </div>
              <time dateTime={entry.created_at} className="shrink-0 text-xs text-stone-400 dark:text-stone-500">
                {formatDateTime(entry.created_at)}
              </time>
            </div>
          ))}

        {!loading && filtered.length === 0 && entries.length > 0 && (
          <EmptyState
            icon={MagnifyingGlass}
            title="No matching history"
            description="Try a different search term."
          />
        )}

        {!loading && entries.length === 0 && (
          <EmptyState
            icon={MagnifyingGlass}
            title="No history yet"
            description="Status and priority changes, and ticket edits, will show up here as they happen."
          />
        )}
      </div>
    </div>
  )
}
