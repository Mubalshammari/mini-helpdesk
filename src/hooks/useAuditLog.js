import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Capped at 200 rows - this is a viewer for a lightweight internal tool, not
// a paginated reporting surface. history_select_admin_only (see
// supabase/migrations.sql section 8) means this query is already a no-op for
// non-admins (zero rows back, not an error), so there's no need to re-check
// the caller's role here - RLS is the actual gate.
const ROW_LIMIT = 200

export function useAuditLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLog = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ticket_history')
      .select('*, ticket:tickets(title), actor:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT)

    if (!error) setEntries(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLog()
  }, [fetchLog])

  return { entries, loading, refetch: fetchLog, rowLimit: ROW_LIMIT }
}
