import { useCallback, useEffect, useRef, useState } from 'react'
import { useRefreshable } from '../context/RefreshContext'

// Realtime, retry and manual refresh share the same read. Only the newest response wins.
export function useWorkspaceQuery(name, read) {
  const [result, setResult] = useState(null)
  const generation = useRef(0)
  const invalidate = useCallback(() => {
    generation.current++
  }, [])
  const refresh = useCallback(async () => {
    const current = ++generation.current
    try {
      const { data, error } = await read()
      if (error) throw error
      if (current === generation.current) setResult({ read, data })
    } catch (error) {
      if (current === generation.current) setResult({ read, error })
    }
  }, [read])

  useEffect(() => {
    refresh()
    return invalidate
  }, [refresh, invalidate])
  useRefreshable(name, refresh)
  return { ...(result?.read === read ? result : {}), refresh }
}
