import { useLocation } from 'react-router-dom'
import { List, ArrowsClockwise } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useRefresh } from '../../context/RefreshContext'
import { useLiveSync } from '../../context/LiveSyncContext'
import NotificationBell from './NotificationBell'
import ThemeToggle from '../ui/ThemeToggle'
import { ROLE_LABELS } from '../../lib/constants'

const ROLE_BADGE_CLASSES = {
  admin: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/30',
  it: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/30',
  employee: 'bg-stone-100 text-stone-600 ring-stone-500/20 dark:bg-stone-500/10 dark:text-stone-400 dark:ring-stone-500/30',
}

function pageTitle(pathname) {
  if (pathname === '/') return 'Overview'
  if (pathname.startsWith('/tickets/')) return 'Ticket details'
  if (pathname === '/tickets') return 'Tickets'
  if (pathname === '/audit-log') return 'Audit log'
  if (pathname === '/users') return 'Users'
  return 'Mini Helpdesk'
}

export default function TopBar({ onOpenMobileNav }) {
  const { profile } = useAuth()
  const { refresh, refreshing, lastUpdated } = useRefresh()
  const { status } = useLiveSync()
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-950/80">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open menu"
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 lg:hidden dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <List size={18} weight="bold" />
          </button>
          <p className="top-location truncate text-base font-semibold text-stone-900 dark:text-stone-100">
            {pageTitle(pathname)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status !== 'connected' && (
            <span
              role="status"
              className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 sm:inline-flex dark:bg-amber-500/10 dark:text-amber-400"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
              {status === 'offline' ? 'Offline' : 'Reconnecting…'}
            </span>
          )}
          {lastUpdated && (
            <span className="hidden text-xs text-stone-400 md:inline dark:text-stone-500">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh"
            title="Refresh"
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:cursor-wait dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <ArrowsClockwise size={18} weight="regular" className={refreshing ? 'animate-spin' : ''} />
          </button>
          <NotificationBell />
          <ThemeToggle />
          <div className="hidden items-center gap-2 pl-1 sm:flex">
            <span className="max-w-[10rem] truncate text-sm font-medium text-stone-700 dark:text-stone-300">
              {profile?.full_name || 'Unnamed user'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                ROLE_BADGE_CLASSES[profile?.role] ?? ROLE_BADGE_CLASSES.employee
              }`}
            >
              {ROLE_LABELS[profile?.role] ?? 'Employee'}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
