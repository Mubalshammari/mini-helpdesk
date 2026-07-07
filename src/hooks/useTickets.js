import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useTickets() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTickets = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    // The explicit user_id filter matters for STAFF, not employees:
    // employees are already restricted to their own rows by RLS
    // (tickets_select_own_or_staff), but staff's RLS lets them see every
    // ticket in the company - without this filter, an IT member's personal
    // "My tickets" page would show everyone's tickets. The company-wide
    // view deliberately lives at /it (the IT queue), not here.
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error)
    } else {
      setTickets(data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // Ticket creation lives in NewTicketContext now (the sidebar's global
  // "+ New Ticket" button), which fires a shared refresh on success - this
  // hook only reads.
  return { tickets, loading, error, refetch: fetchTickets }
}
