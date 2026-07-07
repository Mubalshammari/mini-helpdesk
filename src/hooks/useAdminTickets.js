import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAdminTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    // tickets_select_own_or_staff (migration 0002) lets is_staff() see every
    // row here, not just their own - same query shape as useTickets, the RLS
    // policy is what changes the result set. Status/priority changes happen
    // on the ticket detail page (the pill controls), so this hook is
    // read-only.
    const { data, error } = await supabase
      .from('tickets')
      .select('*, submitter:profiles(full_name)')
      .order('created_at', { ascending: false })

    if (!error) setTickets(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  return { tickets, loading, refetch: fetchTickets }
}
