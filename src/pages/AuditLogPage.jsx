import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, MagnifyingGlass } from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import { useAuth } from '../context/AuthContext'
import { useAuditLog } from '../hooks/useAuditLog'
import { usePageTitle } from '../hooks/usePageTitle'
import AuditLogTable from '../components/staff/AuditLogTable'
import '../audit.css'

export default function AuditLogPage() {
  usePageTitle('Audit trail')
  const { isAdmin } = useAuth()
  const [draft, setDraft] = useState('')
  const [filters, setFilters] = useState({ search: '', kind: 'all', days: 0, page: 1 })
  const { data, error, refresh } = useAuditLog(filters)

  useEffect(() => {
    if (draft.trim() === filters.search) return
    const timer = setTimeout(
      () => setFilters((current) => ({ ...current, search: draft.trim(), page: 1 })),
      250
    )
    return () => clearTimeout(timer)
  }, [draft, filters.search])

  function filter(field, value) {
    setFilters((current) => ({ ...current, [field]: value, page: 1 }))
  }
  const pages = data ? Math.max(1, Math.ceil(data.total / 25)) : 1
  return (
    <AppShell>
      <div className="page-intro">
        <h1>Audit trail</h1>
        <p>
          {isAdmin
            ? 'Review ticket changes, access decisions and account removals.'
            : 'Review assignments, priority changes and edits across the support desk.'}
        </p>
      </div>
      <div className="history-tools">
        <label className="search-box">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search audit trail"
            placeholder="Search activity or people"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        {isAdmin && (
          <select
            aria-label="Activity type"
            value={filters.kind}
            onChange={(e) => filter('kind', e.target.value)}
          >
            <option value="all">All activity</option>
            <option value="ticket">Ticket changes</option>
            <option value="access">Access changes</option>
            <option value="account">Account removals</option>
          </select>
        )}
        <select
          aria-label="Activity date range"
          value={filters.days}
          onChange={(e) => filter('days', Number(e.target.value))}
        >
          <option value={0}>Any time</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </div>
      <section className="sheet history-sheet" aria-label="Recorded activity">
        {error ? (
          <p className="notice" role="alert">
            Couldn’t load activity. <button onClick={refresh}>Try again</button>
          </p>
        ) : !data ? (
          <p className="notice" role="status">
            Loading activity…
          </p>
        ) : (
          <>
            <div className="history-count">
              {data.total.toLocaleString()} {data.total === 1 ? 'event' : 'events'}
            </div>
            <AuditLogTable
              entries={data.rows}
              filtered={Boolean(filters.search || filters.kind !== 'all' || filters.days)}
            />
            {pages > 1 && (
              <nav className="pagination" aria-label="Audit pages">
                <button
                  aria-label="Previous audit page"
                  disabled={data.page === 1}
                  onClick={() => setFilters({ ...filters, page: data.page - 1 })}
                >
                  <ArrowLeft />
                </button>
                <span>
                  Page {data.page} of {pages}
                </span>
                <button
                  aria-label="Next audit page"
                  disabled={data.page >= pages}
                  onClick={() => setFilters({ ...filters, page: data.page + 1 })}
                >
                  <ArrowRight />
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </AppShell>
  )
}
