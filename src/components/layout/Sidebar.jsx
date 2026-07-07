import { Link, NavLink } from 'react-router-dom'
import {
  Headset,
  House,
  Ticket,
  ClockCounterClockwise,
  Users,
  Plus,
  SignOut,
  CaretDoubleLeft,
  CaretDoubleRight,
  X,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useNewTicket } from '../../context/NewTicketContext'
import Avatar from '../ui/Avatar'
import { ROLE_LABELS } from '../../lib/constants'

const navItemClass = (collapsed) =>
  ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      collapsed ? 'justify-center px-2' : ''
    } ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100'
    }`

function SidebarContent({ collapsed, onNavigate }) {
  const { profile, isStaff, isAdmin, signOut } = useAuth()
  const { openNewTicket } = useNewTicket()

  const items = [
    { to: '/', label: 'Dashboard', icon: House, end: true },
    { to: '/tickets', label: 'Tickets', icon: Ticket },
    ...(isStaff ? [{ to: '/audit-log', label: 'Audit log', icon: ClockCounterClockwise }] : []),
    ...(isAdmin ? [{ to: '/users', label: 'Users', icon: Users }] : []),
  ]

  return (
    <>
      <div className={`flex items-center gap-2.5 px-4 py-5 ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
          <Headset size={18} weight="fill" className="text-white" />
        </div>
        {!collapsed && (
          <span className="truncate text-base font-semibold text-stone-900 dark:text-stone-100">Mini Helpdesk</span>
        )}
      </div>

      <div className={`px-3 pb-4 ${collapsed ? 'px-2' : ''}`}>
        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            openNewTicket()
          }}
          title="New ticket"
          className={`flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 active:scale-[0.98] ${
            collapsed ? 'px-0' : 'px-3'
          }`}
        >
          <Plus size={16} weight="bold" />
          {!collapsed && 'New ticket'}
        </button>
      </div>

      <nav className={`flex flex-1 flex-col gap-1 px-3 ${collapsed ? 'px-2' : ''}`}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              onClick={onNavigate}
              className={navItemClass(collapsed)}
            >
              <Icon size={18} weight="regular" className="shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className={`border-t border-stone-200 p-3 dark:border-stone-800 ${collapsed ? 'p-2' : ''}`}>
        <div className={`flex items-center gap-2.5 ${collapsed ? 'flex-col' : ''}`}>
          <Avatar name={profile?.full_name} size={32} />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                {profile?.full_name || 'Unnamed user'}
              </p>
              <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                {ROLE_LABELS[profile?.role] ?? 'Employee'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
          >
            <SignOut size={16} weight="regular" />
          </button>
        </div>
      </div>
    </>
  )
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  return (
    <>
      {/* Desktop: persistent, collapsible to an icon rail. */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-stone-200 bg-white transition-[width] duration-200 lg:flex dark:border-stone-800 dark:bg-stone-950 ${
          collapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        <SidebarContent collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center border-t border-stone-200 py-2.5 text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-600 dark:border-stone-800 dark:hover:bg-stone-900 dark:hover:text-stone-300"
        >
          {collapsed ? <CaretDoubleRight size={14} weight="bold" /> : <CaretDoubleLeft size={14} weight="bold" />}
        </button>
      </aside>

      {/* Mobile: off-canvas drawer behind a hamburger in the top bar. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 animate-overlay-in bg-stone-900/50 backdrop-blur-sm dark:bg-stone-950/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl dark:bg-stone-950">
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800"
            >
              <X size={18} weight="bold" />
            </button>
            <SidebarContent collapsed={false} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  )
}
