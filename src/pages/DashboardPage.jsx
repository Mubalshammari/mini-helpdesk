import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Ticket as TicketIcon } from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import { useAuth } from '../context/AuthContext'
import { useNewTicket } from '../context/NewTicketContext'
import { useTickets } from '../hooks/useTickets'
import { useAdminTickets } from '../hooks/useAdminTickets'
import { usePageTitle } from '../hooks/usePageTitle'
import { useRefreshable } from '../context/RefreshContext'
import StatsCards from '../components/staff/StatsCards'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { formatRelative } from '../lib/format'

function isToday(iso) {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  )
}

function RecentTicketsList({ tickets, emptyDescription }) {
  if (tickets.length === 0) {
    return <EmptyState icon={TicketIcon} title="Nothing here yet" description={emptyDescription} />
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
      <ol className="divide-y divide-stone-100 dark:divide-stone-700">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              to={`/tickets/${ticket.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50 dark:hover:bg-stone-700/50"
            >
              <StatusBadge status={ticket.status} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                {ticket.title}
              </span>
              <time dateTime={ticket.created_at} className="shrink-0 text-xs text-stone-400 dark:text-stone-500">
                {formatRelative(ticket.created_at)}
              </time>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}

function StaffDashboard() {
  const { tickets, loading, refetch } = useAdminTickets()
  useRefreshable('dashboard-staff', refetch)

  const stats = useMemo(
    () => ({
      open: tickets.filter((t) => t.status === 'open').length,
      inProgress: tickets.filter((t) => t.status === 'in_progress').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
      today: tickets.filter((t) => isToday(t.created_at)).length,
    }),
    [tickets]
  )

  return (
    <>
      <StatsCards stats={stats} loading={loading} />

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Latest tickets</h2>
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          View all
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-56 animate-pulse rounded-xl bg-stone-100 dark:bg-stone-800" />
        ) : (
          <RecentTicketsList
            tickets={tickets.slice(0, 5)}
            emptyDescription="New tickets from across the company will show up here."
          />
        )}
      </div>
    </>
  )
}

function EmployeeDashboard() {
  const { openNewTicket } = useNewTicket()
  const { tickets, loading, refetch } = useTickets()
  useRefreshable('dashboard-own', refetch)

  const counts = useMemo(
    () => ({
      open: tickets.filter((t) => t.status === 'open').length,
      inProgress: tickets.filter((t) => t.status === 'in_progress').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
    }),
    [tickets]
  )

  const cards = [
    { label: 'Open', value: counts.open, className: 'text-sky-600 dark:text-sky-400' },
    { label: 'In progress', value: counts.inProgress, className: 'text-amber-600 dark:text-amber-400' },
    { label: 'Resolved', value: counts.resolved, className: 'text-emerald-600 dark:text-emerald-400' },
  ]

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800"
          >
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{card.label}</p>
            {loading ? (
              <div className="mt-2 h-7 w-10 animate-pulse rounded-md bg-stone-200 dark:bg-stone-700" />
            ) : (
              <p className={`mt-1 text-2xl font-semibold ${card.className}`}>{card.value}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Your latest tickets</h2>
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          View all
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-56 animate-pulse rounded-xl bg-stone-100 dark:bg-stone-800" />
        ) : tickets.length === 0 ? (
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
        ) : (
          <RecentTicketsList tickets={tickets.slice(0, 5)} emptyDescription="" />
        )}
      </div>
    </>
  )
}

export default function DashboardPage() {
  usePageTitle('Dashboard')
  const { profile, isStaff } = useAuth()

  return (
    <AppShell>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {isStaff ? "Here's where the queue stands." : "Here's where your requests stand."}
        </p>
      </div>
      <div className="mt-6">{isStaff ? <StaffDashboard /> : <EmployeeDashboard />}</div>
    </AppShell>
  )
}
