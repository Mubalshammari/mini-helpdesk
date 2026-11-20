import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Ticket, ChatCircleDots, CheckCircle } from '@phosphor-icons/react'
import { useNotificationsContext } from '../../context/NotificationsContext'
import { formatRelative } from '../../lib/format'

const TYPE_META = {
  new_ticket: { icon: Ticket, verb: 'submitted a new ticket' },
  new_comment: { icon: ChatCircleDots, verb: 'replied on' },
}

export default function NotificationBell() {
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } = useNotificationsContext()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const panelRef = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape' && panelRef.current?.contains(document.activeElement)) {
        setOpen(false)
        panelRef.current.querySelector('button')?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  async function handleSelect(notification) {
    if (!notification.read) await markAsRead(notification.id)
    setOpen(false)
    if (notification.ticket_id) navigate(`/tickets/${notification.ticket_id}`)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
      >
        <Bell size={18} weight="regular" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="fixed inset-x-3 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full mt-2 sm:w-80 animate-modal-in overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg shadow-stone-900/5 dark:border-stone-700 dark:bg-stone-800"
        >
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-700">
            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                <CheckCircle size={13} weight="bold" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && <p className="px-4 py-8 text-center text-sm text-stone-400">Loading…</p>}

            {!loading && notifications.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-stone-400 dark:text-stone-500">
                No notifications yet.
              </p>
            )}

            {!loading &&
              notifications.map((notification) => {
                const meta = TYPE_META[notification.type] ?? TYPE_META.new_ticket
                const Icon = meta.icon
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleSelect(notification)}
                    className={`flex w-full items-start gap-3 border-b border-stone-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-stone-50 dark:border-stone-700/60 dark:hover:bg-stone-700/50 ${
                      notification.read ? '' : 'bg-indigo-50/50 dark:bg-indigo-500/5'
                    }`}
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-700">
                      <Icon size={14} weight="regular" className="text-stone-500 dark:text-stone-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-stone-700 dark:text-stone-300">
                        <span className="font-medium text-stone-900 dark:text-stone-100">
                          {notification.actor?.full_name || 'Someone'}
                        </span>{' '}
                        {meta.verb}{' '}
                        <span className="font-medium text-stone-900 dark:text-stone-100">
                          {notification.ticket?.title || 'a ticket'}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                        {formatRelative(notification.created_at)}
                      </p>
                    </div>
                    {!notification.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-hidden="true" />
                    )}
                  </button>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
