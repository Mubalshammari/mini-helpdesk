import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MagnifyingGlass, X, ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import StatusBadge, { STATUS_META } from '../components/ui/StatusBadge'
import PriorityIcon from '../components/ui/PriorityIcon'
import { TicketDetail } from './TicketDetailPage'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useWorkspaceQuery } from '../hooks/useWorkspaceQuery'
import { supabase } from '../lib/supabaseClient'
import { STATUSES, CATEGORIES, CATEGORY_LABELS } from '../lib/constants'
import { formatRelative } from '../lib/format'

const scopes = { all: 'All tickets', unassigned: 'Unassigned', mine: 'Assigned to me' }

export default function TicketsPage() {
  usePageTitle('Ticket queue')
  const { isStaff } = useAuth()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') || ''
  const scope = isStaff && Object.hasOwn(scopes, params.get('scope')) ? params.get('scope') : 'all'
  const status = params.get('status') || ''
  const category = params.get('category') || ''
  const page = Math.max(1, Math.min(1000000000, Number.parseInt(params.get('page'), 10) || 1))
  const selected = params.get('ticket')
  const [draft, setDraft] = useState(search)
  const opener = useRef(null)
  const closeButton = useRef(null)
  const setFilters = useCallback(
    (patch, replace = false) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace, preventScrollReset: true }
      )
    },
    [setParams]
  )

  useEffect(() => {
    setDraft(search)
  }, [search])
  useEffect(() => {
    if (draft.trim() === search) return
    const timer = setTimeout(() => setFilters({ q: draft.trim(), page: null }, true), 250)
    return () => clearTimeout(timer)
  }, [draft, search, setFilters])

  useEffect(() => {
    if (selected) closeButton.current?.focus({ preventScroll: true })
  }, [selected])

  const read = useCallback(
    () =>
      supabase.rpc('ticket_queue', {
        p_search: search,
        p_status: STATUSES.includes(status) ? status : null,
        p_category: CATEGORIES.some((c) => c.value === category) ? category : null,
        p_scope: scope,
        p_page: page,
      }),
    [search, status, category, scope, page]
  )
  const { data, error, refresh } = useWorkspaceQuery('queue', read)
  const pages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1

  function closeDetail() {
    setFilters({ ticket: null })
    requestAnimationFrame(() =>
      (opener.current?.isConnected ? opener.current : document.getElementById('queue-search'))?.focus()
    )
  }

  return (
    <AppShell>
      <div className="page-intro">
        <h1>{isStaff ? 'Ticket queue' : 'My requests'}</h1>
        <p>
          {isStaff
            ? 'Pick up a request or follow work already in progress.'
            : 'Track your requests and talk to the support team.'}
        </p>
      </div>
      {isStaff && (
        <div className="scope-tabs" aria-label="Assignment filters">
          {Object.entries(scopes).map(([key, label]) => (
            <button
              key={key}
              aria-pressed={scope === key}
              onClick={() => setFilters({ scope: key, page: null })}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="queue-tools">
        <label className="search-box">
          <MagnifyingGlass size={18} />
          <input
            id="queue-search"
            type="search"
            aria-label="Search tickets"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search tickets or requesters"
          />
        </label>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setFilters({ status: e.target.value, page: null })}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <select
          aria-label="Category"
          value={category}
          onChange={(e) => setFilters({ category: e.target.value, page: null })}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className={selected ? 'queue-layout with-detail' : 'queue-layout'}>
        <section className="sheet queue-list" aria-label="Tickets">
          {error ? (
            <div role="alert" className="notice">
              Couldn’t load tickets. <button onClick={refresh}>Try again</button>
            </div>
          ) : !data ? (
            <p className="notice" role="status">
              Loading tickets…
            </p>
          ) : (
            <>
              <div className="queue-heading">
                <strong>
                  {data.total.toLocaleString()} {data.total === 1 ? 'ticket' : 'tickets'}
                </strong>
                <span>Last updated</span>
              </div>
              {data.rows.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={'/tickets/' + ticket.id}
                  className="ticket-row"
                  aria-current={ticket.id === selected ? 'true' : undefined}
                  onClick={(e) => {
                    if (
                      !e.metaKey &&
                      !e.ctrlKey &&
                      !e.shiftKey &&
                      !e.altKey &&
                      window.matchMedia('(min-width: 1000px)').matches
                    ) {
                      e.preventDefault()
                      opener.current = e.currentTarget
                      setFilters({ ticket: ticket.id })
                    }
                  }}
                >
                  <div className="row-main">
                    <small>
                      {CATEGORY_LABELS[ticket.category]} · {ticket.requester}
                    </small>
                    <strong>{ticket.title}</strong>
                    <span className="row-owner">{ticket.assignee || 'Unassigned'}</span>
                  </div>
                  <div className="row-state">
                    <StatusBadge status={ticket.status} size="sm" />
                    <PriorityIcon priority={ticket.priority} />
                  </div>
                  <time dateTime={ticket.updated_at}>{formatRelative(ticket.updated_at)}</time>
                </Link>
              ))}
              {!data.rows.length && <p className="notice">No tickets in this view.</p>}
              <nav className="pagination" aria-label="Ticket pages">
                <button
                  aria-label="Previous page"
                  disabled={data.page <= 1}
                  onClick={() => setFilters({ page: data.page - 1 })}
                >
                  <ArrowLeft />
                </button>
                <span>
                  Page {data.page} of {pages}
                </span>
                <button
                  aria-label="Next page"
                  disabled={data.page >= pages}
                  onClick={() => setFilters({ page: data.page + 1 })}
                >
                  <ArrowRight />
                </button>
              </nav>
            </>
          )}
        </section>
        {selected && (
          <section className="detail-panel" aria-label="Selected ticket">
            <header>
              <Link to={'/tickets/' + selected}>Open full page ↗</Link>
              <button ref={closeButton} aria-label="Close ticket panel" onClick={closeDetail}>
                <X size={18} />
              </button>
            </header>
            <TicketDetail key={selected} id={selected} embedded />
          </section>
        )}
      </div>
    </AppShell>
  )
}
