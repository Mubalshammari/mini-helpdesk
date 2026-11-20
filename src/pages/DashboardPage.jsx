import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarBlank,
  CheckCircle,
  CircleNotch,
  Lightning,
  Stack,
  Ticket,
  Tray,
  UserCircle,
} from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import StatusBadge, { STATUS_META } from '../components/ui/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useWorkspaceQuery } from '../hooks/useWorkspaceQuery'
import { supabase } from '../lib/supabaseClient'
import { formatRelative } from '../lib/format'

const statuses = ['open', 'in_progress', 'resolved', 'closed']
const count = new Intl.NumberFormat()
const calendarDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

function displayCount(value) {
  return value == null ? '…' : count.format(value)
}

function Summary({ data, isStaff }) {
  const waitingCount = isStaff ? data?.unassigned : data?.open
  const focusRoute = isStaff ? '/tickets?scope=unassigned&sort=oldest' : '/tickets?status=open'

  return (
    <section className="desk-summary" aria-label="Ticket summary">
      <div className="summary-focus">
        <div className="focus-stamp" aria-hidden="true">
          <Tray weight="duotone" />
        </div>
        <div className="summary-label">
          <Tray size={18} />
          {isStaff ? 'Awaiting assignment' : 'Open requests'}
        </div>
        <p className="summary-value">{displayCount(waitingCount)}</p>
        <Link to={focusRoute} className="focus-action">
          {isStaff ? 'View unassigned' : 'View open requests'} <ArrowRight weight="bold" />
        </Link>
      </div>
      <Link className="summary-stat" to="/tickets?status=in_progress">
        <span className="stat-symbol progress-symbol">
          <Stack size={21} weight="duotone" />
        </span>
        <span className="summary-label">In progress</span>
        <strong className="summary-value">{displayCount(data?.in_progress)}</strong>
        <span className="stat-caption">
          View in progress <ArrowUpRight />
        </span>
      </Link>
      <div className="summary-stat">
        <span className="stat-symbol today-symbol">
          <CalendarBlank size={21} weight="duotone" />
        </span>
        <span className="summary-label">Opened today</span>
        <strong className="summary-value">{displayCount(data?.today)}</strong>
        <span className="stat-caption">Since local midnight</span>
      </div>
    </section>
  )
}

function Workload({ data }) {
  const total = statuses.reduce((sum, status) => sum + (data?.[status] ?? 0), 0)
  return (
    <section className="overview-panel workload-panel" aria-labelledby="workload-title">
      <div className="overview-section-title">
        <h2 id="workload-title">Workload by status</h2>
        <span className="panel-total">{displayCount(data ? total : null)} total</span>
      </div>
      <ul className="status-distribution">
        {statuses.map((status) => {
          const value = data?.[status] ?? 0
          return (
            <li key={status}>
              <Link to={'/tickets?status=' + status} className={'distribution-row is-' + status}>
                <span className="distribution-label">{STATUS_META[status].label}</span>
                <strong>{displayCount(data?.[status])}</strong>
                <span className="distribution-track" aria-hidden="true">
                  <span style={{ width: (total ? (value / total) * 100 : 0) + '%' }} />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function RecentActivity({ tickets }) {
  return (
    <section className="overview-panel recent-panel" aria-labelledby="recent-title">
      <div className="overview-section-title">
        <h2 id="recent-title">Recent activity</h2>
        <Link className="overview-text-link" to="/tickets">
          View tickets <ArrowRight size={15} />
        </Link>
      </div>
      {tickets === undefined ? (
        <p role="status" className="activity-empty">
          <CircleNotch size={20} /> Loading activity…
        </p>
      ) : tickets.length === 0 ? (
        <div className="activity-empty">
          <CheckCircle size={24} weight="duotone" />
          New tickets and replies will appear here.
        </div>
      ) : (
        <ul className="recent-tickets">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link to={'/tickets/' + ticket.id}>
                <span className={'ticket-glyph priority-' + ticket.priority} aria-hidden="true">
                  <Ticket size={19} />
                </span>
                <span className="recent-ticket-name">
                  <strong>{ticket.title}</strong>
                  <small>{ticket.priority} priority</small>
                </span>
                <StatusBadge status={ticket.status} size="sm" />
                <time dateTime={ticket.updated_at}>{formatRelative(ticket.updated_at)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function QueueShortcuts() {
  return (
    <nav aria-label="Staff queue shortcuts" className="queue-shortcuts">
      <Link to="/tickets?scope=urgent">
        <Lightning weight="fill" size={17} />
        Urgent tickets
        <ArrowUpRight size={14} />
      </Link>
      <Link to="/tickets?scope=mine">
        <UserCircle size={18} />
        Assigned to me
        <ArrowUpRight size={14} />
      </Link>
    </nav>
  )
}

export default function DashboardPage() {
  usePageTitle('Overview')
  const { isStaff } = useAuth()
  const read = useCallback(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return supabase.rpc('ticket_overview', {
      p_day_start: start.toISOString(),
      p_day_end: end.toISOString(),
    })
  }, [])
  const { data, error, refresh } = useWorkspaceQuery('overview', read)

  return (
    <AppShell>
      <div className="operations-overview">
        <header className="overview-masthead">
          <h1>{isStaff ? 'Support overview' : 'My overview'}</h1>
          <span className="overview-date">
            <CalendarBlank size={16} />
            {calendarDate.format(new Date())}
          </span>
        </header>
        {error ? (
          <div className="sheet notice" role="alert">
            Couldn’t load the overview. <button onClick={refresh}>Try again</button>
          </div>
        ) : (
          <>
            <Summary data={data} isStaff={isStaff} />
            <div className="overview-details">
              <RecentActivity tickets={data?.recent} />
              <div className="workload-column">
                <Workload data={data} />
                {isStaff && <QueueShortcuts />}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
