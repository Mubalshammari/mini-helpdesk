import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useWorkspaceQuery } from './useWorkspaceQuery'

export function useAuditLog({ search, kind, days, page }) {
  const read = useCallback(() => {
    const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null
    return supabase.rpc('audit_activity', {
      p_search: search,
      p_kind: kind,
      p_since: since,
      p_page: page,
    })
  }, [search, kind, days, page])

  return useWorkspaceQuery('audit-log', read)
}
