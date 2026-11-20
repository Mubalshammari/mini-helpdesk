import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowsDownUp,
  FadersHorizontal,
  MagnifyingGlass,
  Plus,
  Stack,
  Tray,
  UserCircle,
  UserCirclePlus,
  Warning,
  X,
} from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import Avatar from '../components/ui/Avatar'
import PriorityIcon, { PRIORITY_META } from '../components/ui/PriorityIcon'
import StatusBadge, { STATUS_META } from '../components/ui/StatusBadge'
import { TicketDetail } from './TicketDetailPage'
import { useAuth } from '../context/AuthContext'
import { useNewTicket } from '../context/NewTicketContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { useWorkspaceQuery } from '../hooks/useWorkspaceQuery'
import { CATEGORIES, CATEGORY_LABELS, PRIORITIES, STATUSES } from '../lib/constants'
import { formatRelative } from '../lib/format'
import { supabase } from '../lib/supabaseClient'
import '../queue.css'

const views = {
  all: { label: 'All tickets', icon: Stack },
  unassigned: { label: 'Unassigned', icon: Tray },
  mine: { label: 'Assigned to me', icon: UserCircle },
  urgent: { label: 'Urgent & active', icon: Warning },
}

const sortLabels = {
  recent: 'Latest activity',
  priority: 'Highest priority',
  oldest: 'Oldest active first',
}

function TicketRow({ ticket, selected, onPreview, sort }) {
  const time = sort === 'oldest' ? ticket.created_at : ticket.updated_at
  return (
    <Link
      to={'/tickets/' + ticket.id}
      className="ticket-row triage-row"
      aria-current={selected ? 'true' : undefined}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        if (!window.matchMedia('(min-width: 1000px)').matches) return
        event.preventDefault()
        onPreview(event.currentTarget, ticket.id)
      }}
    >
      <div className="subject-cell">
        <strong>{ticket.title}</strong>
        <span>
          {CATEGORY_LABELS[ticket.category]} <b aria-hidden="true">·</b> {ticket.requester}
        </span>
      </div>
      <div className="priority-cell">
        <PriorityIcon priority={ticket.priority} />
      </div>
      <div className="status-cell">
        <StatusBadge status={ticket.status} size="sm" />
      </div>
      <div className="assignee-cell">
        {ticket.assigned_to ? <Avatar name={ticket.assignee} size={24} /> : <UserCirclePlus size={21} />}
        <span>{ticket.assignee || 'Unassigned'}</span>
      </div>
      <time dateTime={time} title={new Date(time).toLocaleString()}>
        {formatRelative(time)}
      </time>
    </Link>
  )
}

export default function TicketsPage() {
  usePageTitle('Ticket queue')
  const { isStaff } = useAuth()
  const { openNewTicket } = useNewTicket()
  const [params, setParams] = useSearchParams()
  const search = params.get('q') || ''
  const scope = isStaff && Object.hasOwn(views, params.get('scope')) ? params.get('scope') : 'all'
  const status = STATUSES.includes(params.get('status')) ? params.get('status') : ''
  const category = Object.hasOwn(CATEGORY_LABELS, params.get('category')) ? params.get('category') : ''
  const priority = PRIORITIES.includes(params.get('priority')) ? params.get('priority') : ''
  const sort = Object.hasOwn(sortLabels, params.get('sort')) ? params.get('sort') : 'recent'
  const page = Math.max(1, Math.min(1000000000, Number.parseInt(params.get('page'), 10) || 1))
  const selected = params.get('ticket')
  const [draft, setDraft] = useState(search)
  const [showFilters, setShowFilters] = useState(Boolean(status || category || priority))
  const opener = useRef(null)
  const closeButton = useRef(null)
  const searchBox = useRef(null)
  const filterCount = [status, category, priority].filter(Boolean).length
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
        p_status: status || null,
        p_category: category || null,
        p_priority: priority || null,
        p_scope: scope,
        p_page: page,
        p_sort: sort,
      }),
    [search, status, category, priority, scope, page, sort]
  )
  const { data, error, refresh } = useWorkspaceQuery('queue', read)
  const pages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1

  function closeDetail() {
    setFilters({ ticket: null })
    requestAnimationFrame(() =>
      (opener.current?.isConnected ? opener.current : searchBox.current)?.focus()
    )
  }

  function resetFilters() {
    setDraft('')
    setFilters({ q: null, status: null, priority: null, category: null, page: null })
  }

  return (
    <AppShell>
      <div className="page-intro triage-intro">
        <div>
          <h1>{isStaff ? 'Ticket queue' : 'My requests'}</h1>
          <p>
            {isStaff
              ? 'Review incoming requests, assign work and follow up with your team.'
              : 'Track your requests and follow up with the support team.'}
          </p>
        </div>
        <button className="triage-create" onClick={openNewTicket}>
          <Plus size={17} weight="bold" />
          New request
        </button>
      </div>
      {isStaff && (
        <div className="triage-views" aria-label="Ticket views">
          {Object.entries(views).map(([key, view]) => {
            const Icon = view.icon
            return (
              <button
                key={key}
                aria-pressed={scope === key}
                onClick={() => setFilters({ scope: key, page: null })}
              >
                <Icon size={17} weight={scope === key ? 'fill' : 'regular'} />
                {view.label}
              </button>
            )
          })}
        </div>
      )}
      <div className="triage-toolbar">
        <label className="search-box triage-search">
          <MagnifyingGlass size={18} />
          <input
            id="queue-search"
            ref={searchBox}
            type="search"
            aria-label="Search tickets"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search tickets or requesters"
          />
        </label>
        <button
          className="filter-toggle"
          aria-expanded={showFilters}
          aria-controls="triage-filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FadersHorizontal size={17} />
          Filters{filterCount > 0 && <span>{filterCount}</span>}
        </button>
        <label className="sort-control">
          <ArrowsDownUp size={17} />
          <select
            aria-label="Sort tickets"
            value={sort}
            onChange={(event) => setFilters({ sort: event.target.value, page: null })}
          >
            {Object.entries(sortLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {showFilters && (
        <div id="triage-filters" className="triage-filters">
          <label>
            Status
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
          </label>
          <label>
            Priority
            <select
              aria-label="Priority"
              value={priority}
              onChange={(e) => setFilters({ priority: e.target.value, page: null })}
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
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
          </label>
          {Boolean(filterCount || search) && (
            <button className="triage-reset" onClick={resetFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}
      <div
        className={selected ? 'queue-layout with-detail triage-layout' : 'queue-layout triage-layout'}
      >
        <section className="sheet queue-list triage-list" aria-label="Tickets">
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
              <div className="triage-list-head">
                <h2>{isStaff ? views[scope].label : 'Requests'}</h2>
                <span role="status">
                  {data.total.toLocaleString()} {data.total === 1 ? 'ticket' : 'tickets'}
                </span>
              </div>
              {data.rows.length > 0 ? (
                <>
                  <div className="triage-columns" aria-hidden="true">
                    <span>Request</span>
                    <span>Priority</span>
                    <span>Status</span>
                    <span>Assignee</span>
                    <span>{sort === 'oldest' ? 'Opened' : 'Updated'}</span>
                  </div>
                  {data.rows.map((ticket) => (
                    <TicketRow
                      key={ticket.id}
                      ticket={ticket}
                      sort={sort}
                      selected={selected === ticket.id}
                      onPreview={(element, id) => {
                        opener.current = element
                        setFilters({ ticket: id })
                      }}
                    />
                  ))}
                </>
              ) : (
                <div className="triage-empty">
                  <Tray size={29} />
                  <h3>{search || filterCount ? 'No matching tickets' : 'No tickets in this view'}</h3>
                  {Boolean(search || filterCount) && (
                    <button onClick={resetFilters}>Clear filters</button>
                  )}
                </div>
              )}
              <nav className="pagination triage-pages" aria-label="Ticket pages">
                <span>
                  Page {data.page} of {pages}
                </span>
                <button
                  aria-label="Previous page"
                  disabled={data.page <= 1}
                  onClick={() => setFilters({ page: data.page - 1 })}
                >
                  <ArrowLeft />
                </button>
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
              <Link to={'/tickets/' + selected}>
                Open full page <ArrowUpRight size={14} />
              </Link>
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
