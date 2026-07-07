import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useTicket(ticketId) {
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const fetchTicket = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    const { data, error } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle()

    // maybeSingle() returns { data: null, error: null } for zero rows, which
    // covers both "no such ticket" and "RLS hid it because it isn't yours" -
    // deliberately indistinguishable, so the detail page can't be used to
    // probe whether a given ticket id exists for someone else.
    if (error || !data) {
      setNotFound(true)
      setTicket(null)
    } else {
      setTicket(data)
    }
    setLoading(false)
  }, [ticketId])

  useEffect(() => {
    fetchTicket()
  }, [fetchTicket])

  const updateTicket = useCallback(
    async (patch) => {
      const { data, error } = await supabase
        .from('tickets')
        .update(patch)
        .eq('id', ticketId)
        .select()
        .single()
      if (error) throw error
      setTicket(data)
      return data
    },
    [ticketId]
  )

  // Optimistic variant for the status/priority pills: the UI flips
  // immediately (the change was already confirmed via dialog, and it
  // succeeds in the overwhelming majority of cases), then reconciles with
  // the server's row. On error the previous state comes back and the error
  // propagates so the caller can toast it. The server is still the
  // authority - RLS and the ticket-update trigger reject anything the
  // caller isn't actually allowed to do, optimism or not.
  const updateTicketOptimistic = useCallback(
    async (patch) => {
      let previous
      setTicket((current) => {
        previous = current
        return current ? { ...current, ...patch } : current
      })

      const { data, error } = await supabase
        .from('tickets')
        .update(patch)
        .eq('id', ticketId)
        .select()
        .single()

      if (error) {
        setTicket(previous)
        throw error
      }
      setTicket(data)
      return data
    },
    [ticketId]
  )

  return { ticket, loading, notFound, refetch: fetchTicket, updateTicket, updateTicketOptimistic }
}
