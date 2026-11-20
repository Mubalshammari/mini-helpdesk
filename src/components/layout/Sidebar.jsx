import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import {
  SquaresFour,
  Tray,
  Fingerprint,
  UsersThree,
  Plus,
  SignOut,
  SidebarSimple,
  X,
  Ticket,
} from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useNewTicket } from '../../context/NewTicketContext'
import { ROLE_LABELS } from '../../lib/constants'
import Avatar from '../ui/Avatar'

function Navigation({ compact, close, toggle }) {
  const { profile, isStaff, isAdmin, signOut } = useAuth()
  const { openNewTicket } = useNewTicket()
  const links = [
    ['/', 'Overview', SquaresFour],
    ['/tickets', 'Ticket queue', Tray],
    ...(isStaff ? [['/audit-log', 'Audit trail', Fingerprint]] : []),
    ...(isAdmin ? [['/users', 'Team directory', UsersThree]] : []),
  ]
  return (
    <>
      <div className="rail-brand">
        <Ticket size={28} weight="duotone" />
        {!compact && <strong>Mini Helpdesk</strong>}
        {close && (
          <button aria-label="Close menu" onClick={close}>
            <X />
          </button>
        )}
      </div>
      <button
        className="rail-create"
        aria-label="New ticket"
        title="New ticket"
        onClick={() => {
          close?.()
          openNewTicket()
        }}
      >
        <Plus size={18} />
        {!compact && 'New ticket'}
      </button>
      <nav aria-label="Workspace">
        {links.map(([url, label, icon]) => {
          const Icon = icon
          return (
            <NavLink
              key={url}
              to={url}
              end={url === '/'}
              title={compact ? label : undefined}
              aria-label={label}
              onClick={close}
            >
              <Icon size={21} />
              {!compact && label}
            </NavLink>
          )
        })}
      </nav>
      <div className="rail-account">
        <Avatar name={profile?.full_name} size={32} />
        {!compact && (
          <div>
            <strong>{profile?.full_name || 'Your account'}</strong>
            <small>{ROLE_LABELS[profile?.role]}</small>
          </div>
        )}
        <button aria-label="Sign out" title="Sign out" onClick={signOut}>
          <SignOut size={19} />
        </button>
      </div>
      {toggle && (
        <button
          className="rail-toggle"
          onClick={toggle}
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <SidebarSimple size={18} />
          {!compact && 'Collapse sidebar'}
        </button>
      )}
    </>
  )
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const drawer = useRef(null)
  useEffect(() => {
    if (mobileOpen) drawer.current?.showModal()
    else drawer.current?.close()
  }, [mobileOpen])
  return (
    <>
      <aside className={'desk-rail desktop-rail' + (collapsed ? ' compact' : '')}>
        <Navigation compact={collapsed} toggle={onToggleCollapse} />
      </aside>
      <dialog
        className="mobile-drawer"
        ref={drawer}
        onCancel={onCloseMobile}
        onClick={(e) => {
          if (e.target === drawer.current) onCloseMobile()
        }}
      >
        <div className="desk-rail">
          <Navigation close={onCloseMobile} />
        </div>
      </dialog>
    </>
  )
}
