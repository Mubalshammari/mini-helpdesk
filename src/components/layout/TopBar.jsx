import { Link, useLocation } from 'react-router-dom'
import { ArrowsClockwise, CaretRight, List, Plus, SquaresFour } from '@phosphor-icons/react'
import { useRefresh } from '../../context/RefreshContext'
import { useLiveSync } from '../../context/LiveSyncContext'
import { useNewTicket } from '../../context/NewTicketContext'
import NotificationBell from './NotificationBell'
import ThemeToggle from '../ui/ThemeToggle'

function pageTitle(pathname) {
  if (pathname === '/') return 'Overview'
  if (pathname.startsWith('/tickets/')) return 'Ticket details'
  if (pathname === '/tickets') return 'Tickets'
  if (pathname === '/audit-log') return 'Audit trail'
  if (pathname === '/users') return 'Team directory'
  return 'Workspace'
}

export default function TopBar({ onOpenMobileNav }) {
  const { refresh, refreshing, lastUpdated } = useRefresh()
  const { status } = useLiveSync()
  const { openNewTicket } = useNewTicket()
  const { pathname } = useLocation()

  return (
    <header className="workspace-bar">
      <div className="workspace-path">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="mobile-nav-trigger"
        >
          <List size={20} />
        </button>
        <nav aria-label="Current location">
          <Link to="/" className="workspace-home" aria-label="Mini Helpdesk home">
            <SquaresFour size={16} weight="duotone" />
            <span>Workspace</span>
          </Link>
          <CaretRight size={12} className="path-divider" />
          <span aria-current="page">{pageTitle(pathname)}</span>
        </nav>
      </div>
      <div className="workspace-tools">
        {status !== 'connected' && (
          <span className="connection-state" role="status">
            {status === 'offline' ? 'Offline' : 'Reconnecting…'}
          </span>
        )}
        {lastUpdated && (
          <span className="refresh-time">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          type="button"
          className="mobile-create"
          onClick={openNewTicket}
          aria-label="New ticket"
          title="New ticket"
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh"
          title="Refresh"
        >
          <ArrowsClockwise size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  )
}
