import { createContext, useContext } from 'react'
import { useAuth } from './AuthContext'
import { useNotifications } from '../hooks/useNotifications'

const NotificationsContext = createContext(null)

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const notificationsState = useNotifications(user?.id)

  return <NotificationsContext.Provider value={notificationsState}>{children}</NotificationsContext.Provider>
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotificationsContext must be used within a NotificationsProvider')
  return ctx
}
