import { useMemo, useState } from 'react'
import { MagnifyingGlass, Plus, Ticket as TicketIcon } from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import { useAuth } from '../context/AuthContext'
import { useNewTicket } from '../context/NewTicketContext'
import { useTickets } from '../hooks/useTickets'
import { useAdminTickets } from '../hooks/useAdminTickets'
import { usePageTitle } from '../hooks/usePageTitle'
import { useRefreshable } from '../context/RefreshContext'
import TicketCard from '../components/tickets/TicketCard'
import TicketsQueueTable from '../components/staff/TicketsQueueTable'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { TicketCardSkeleton } from '../components/ui/Skeleton'
import { CATEGORIES, STATUSES } from '../lib/constants'
import { STATUS_META } from '../components/ui/StatusBadge'

// One route, two views: employees get their own tickets as cards, staff get
// the whole company's queue as a table. Same sidebar entry either way, so
// nobody has to know which "version" of the page they're on.
export default function TicketsPage() {
  usePageTitle('Tickets')
  const { isStaff } = useAuth()
  return <AppShell>{isStaff ? <StaffTickets /> : <EmployeeTickets />}</AppShell>
}

function StaffTickets() {
  const { tickets, loading, refetch } = useAdminTickets()
  useRefreshable('tickets-staff', refetch)

  return (
    <>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Every ticket across the company. Click a row to open it and act on it.
      </p>
      <div className="mt-5">
        <TicketsQueueTable tickets={tickets} loading={loading} />
      </div>
    </>
  )
}

function EmployeeTickets() {
  const { openNewTicket } = useNewTicket()
  const { tickets, loading, refetch } = useTickets()
  useRefreshable('tickets-own', refetch)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const statusCounts = useMemo(() => {
    const counts = { all: tickets.length }
    for (const s of STATUSES) counts[s] = 0
    for (const t of tickets) counts[t.status] = (counts[t.status] ?? 0) + 1
    return counts
  }, [tickets])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
      if (q && !t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false
      return true
    })
  }, [tickets, search, statusFilter, categoryFilter])

  const hasActiveFilters = search || statusFilter !== 'all' || categoryFilter !== 'all'

  return (
    <>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Your support requests, from open to resolved.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {['all', ...STATUSES].map((s) => {
          const active = statusFilter === s
          const label = s === 'all' ? 'All' : STATUS_META[s].label
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                active
                  ? 'bg-indigo-600 text-white ring-indigo-600'
                  : 'bg-white text-stone-600 ring-stone-200 hover:bg-stone-50 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700 dark:hover:bg-stone-700'
              }`}
            >
              {label}
              <span className={active ? 'text-indigo-200' : 'text-stone-400 dark:text-stone-500'}>
                {statusCounts[s] ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your tickets"
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading && Array.from({ length: 6 }).map((_, i) => <TicketCardSkeleton key={i} />)}

        {!loading && filtered.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}
      </div>

      {!loading && filtered.length === 0 && tickets.length > 0 && (
        <EmptyState
          icon={MagnifyingGlass}
          title="No tickets match your filters"
          description="Try a different search term or clear the filters to see everything."
        />
      )}

      {!loading && tickets.length === 0 && !hasActiveFilters && (
        <EmptyState
          icon={TicketIcon}
          title="No tickets yet"
          description="When something needs IT's attention, file a ticket and track it here."
          action={
            <Button onClick={openNewTicket}>
              <Plus size={16} weight="bold" />
              Create your first ticket
            </Button>
          }
        />
      )}
    </>
  )
}
