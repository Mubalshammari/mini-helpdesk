import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// One shared "refresh whatever is on screen" channel. Pages register their
// refetch functions while mounted; the top-bar Refresh button (and anything
// else that changes data from outside a page, like the global New Ticket
// modal) calls refresh() to re-run all of them. This keeps the button dumb -
// it doesn't know or care what page is open - and keeps pages in charge of
// what "refreshing" means for them.
const RefreshContext = createContext(null)

export function RefreshProvider({ children }) {
  const fetchersRef = useRef(new Map())
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const register = useCallback((key, fn) => {
    fetchersRef.current.set(key, fn)
    return () => {
      // Only delete if the entry still points at this fn - a remount may
      // have already re-registered under the same key, and the old
      // unmount's cleanup must not wipe out the new registration.
      if (fetchersRef.current.get(key) === fn) fetchersRef.current.delete(key)
    }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all(Array.from(fetchersRef.current.values()).map((fn) => fn()))
      setLastUpdated(new Date())
    } finally {
      setRefreshing(false)
    }
  }, [])

  return (
    <RefreshContext.Provider value={{ register, refresh, refreshing, lastUpdated }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh() {
  const ctx = useContext(RefreshContext)
  if (!ctx) throw new Error('useRefresh must be used within a RefreshProvider')
  return ctx
}

// Convenience for pages: keep this page's refetch registered while mounted.
export function useRefreshable(key, fn) {
  const { register } = useRefresh()
  useEffect(() => register(key, fn), [key, fn, register])
}
