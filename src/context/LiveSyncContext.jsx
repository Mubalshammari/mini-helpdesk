import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'
import { useRefresh } from './RefreshContext'

// Live sync sits on top of the same refresh channel the manual button uses:
// a realtime event doesn't patch the UI from the event payload, it just
// nudges the current page to refetch. That's deliberate - manual refresh,
// realtime nudge, and reconnect catch-up all share ONE "get current data"
// path, so there's no second data-merging code path to get subtly wrong,
// and RLS stays the single authority on what each refetch returns.
//
// Delivery of events is itself RLS-gated server-side (Realtime re-checks
// the subscriber's SELECT policies - see supabase/migrations/0005), so an
// employee only ever gets nudged for changes to rows they can already see.
const LiveSyncContext = createContext(null)

export function LiveSyncProvider({ children }) {
  const { user } = useAuth()
  const { refresh } = useRefresh()
  const [status, setStatus] = useState('connected') // 'connected' | 'reconnecting' | 'offline'
  const debounceRef = useRef(null)
  const droppedRef = useRef(false)
  const userId = user?.id

  // A burst of events (e.g. a ticket insert immediately followed by its
  // notification-driven comment) collapses into one refetch.
  const queueRefresh = useCallback(() => {
    if (debounceRef.current) return
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      refresh()
    }, 400)
  }, [refresh])

  useEffect(() => {
    if (!userId) return undefined

    const channel = supabase
      .channel('live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, queueRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_comments' }, queueRefresh)
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          setStatus('connected')
          // Anything that changed while the connection was down was never
          // delivered - refetch once on re-subscribe to catch up. Skipped
          // on the very first subscribe, when pages just loaded their own
          // data anyway.
          if (droppedRef.current) {
            droppedRef.current = false
            refresh()
          }
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          // supabase-js rejoins dropped channels itself (with backoff);
          // this only tracks the status so the top bar can say so.
          droppedRef.current = true
          setStatus('reconnecting')
        }
      })

    const onOffline = () => {
      droppedRef.current = true
      setStatus('offline')
    }
    const onOnline = () => setStatus('reconnecting')
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      supabase.removeChannel(channel)
    }
  }, [userId, queueRefresh, refresh])

  return <LiveSyncContext.Provider value={{ status }}>{children}</LiveSyncContext.Provider>
}

export function useLiveSync() {
  const ctx = useContext(LiveSyncContext)
  if (!ctx) throw new Error('useLiveSync must be used within a LiveSyncProvider')
  return ctx
}
