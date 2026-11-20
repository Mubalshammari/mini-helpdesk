import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowRight, Tray, Stack, CheckCircle, Archive } from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import StatusBadge, { STATUS_META } from '../components/ui/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useWorkspaceQuery } from '../hooks/useWorkspaceQuery'
import { supabase } from '../lib/supabaseClient'
import { formatRelative } from '../lib/format'

const stages = { open: Tray, in_progress: Stack, resolved: CheckCircle, closed: Archive }

export default function DashboardPage() {
  usePageTitle('Overview')
  const { profile, isStaff } = useAuth()
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
  const total = Object.keys(stages).reduce((sum, key) => sum + (data?.[key] || 0), 0)

  return (
    <AppShell>
      <div className="page-intro intro-line">
        <div>
          <h1>{isStaff ? 'Support overview' : 'My overview'}</h1>
          <p>
            {profile?.full_name || 'Your workspace'} <span aria-hidden="true">/</span>{' '}
            {new Intl.DateTimeFormat(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(new Date())}
          </p>
        </div>
      </div>
      {error ? (
        <div className="sheet notice" role="alert">
          Couldn’t load the overview. <button onClick={refresh}>Try again</button>
        </div>
      ) : (
        <>
          <section className="overview-grid" aria-label="Ticket summary">
            <div className="dispatch-card">
              <div className="dispatch-art" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <span>{isStaff ? 'Awaiting assignment' : 'Open requests'}</span>
              <strong>{data ? data[isStaff ? 'unassigned' : 'open'] : '…'}</strong>
              <Link to={isStaff ? '/tickets?scope=unassigned' : '/tickets?status=open'}>
                {isStaff ? 'View unassigned' : 'View open requests'} <ArrowUpRight />
              </Link>
            </div>
            <div className="sheet volume">
              <div className="section-line">
                <h2>Ticket breakdown</h2>
                <span>{data ? total : '…'} total</span>
              </div>
              <div className="spectrum" aria-hidden="true">
                {total > 0 &&
                  Object.keys(stages).map((key) => (
                    <i key={key} className={'stage-' + key} style={{ flexGrow: data[key] }} />
                  ))}
              </div>
              <div className="stage-list">
                {Object.entries(stages).map(([key, icon]) => {
                  const Icon = icon
                  return (
                    <Link to={'/tickets?status=' + key} key={key}>
                      <Icon size={18} />
                      <span>{STATUS_META[key].label}</span>
                      <b>{data?.[key] ?? '…'}</b>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
          <div className="section-line feed-title">
            <h2>Recent activity</h2>
            <Link to="/tickets">
              View tickets <ArrowRight />
            </Link>
          </div>
          <section className="sheet activity-feed" aria-label="Recently updated tickets">
            {!data ? (
              <p className="notice" role="status">
                Loading activity…
              </p>
            ) : data.recent.length ? (
              data.recent.map((t) => (
                <Link key={t.id} to={'/tickets/' + t.id}>
                  <div>
                    <small>{t.priority} priority</small>
                    <strong>{t.title}</strong>
                  </div>
                  <StatusBadge status={t.status} size="sm" />
                  <time dateTime={t.updated_at}>{formatRelative(t.updated_at)}</time>
                </Link>
              ))
            ) : (
              <p className="notice">New tickets and ticket updates will appear here.</p>
            )}
          </section>
          {data && (
            <p className="daily-count">
              {data.today} {data.today === 1 ? 'request' : 'requests'} opened today
            </p>
          )}
        </>
      )}
    </AppShell>
  )
}
