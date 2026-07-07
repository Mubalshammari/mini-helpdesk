import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useComments(ticketId) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchComments = useCallback(async () => {
    setLoading(true)
    // author:profiles(...) uses PostgREST's foreign-key embedding (via the
    // real ticket_comments.user_id -> profiles.id FK) to join the
    // commenter's name/role in one round trip instead of N+1 queries.
    // Readable for any authenticated user per the profiles_select_any_authenticated
    // policy (see supabase/migrations.sql section 5).
    const { data, error } = await supabase
      .from('ticket_comments')
      .select('*, author:profiles(full_name, role)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (!error) setComments(data)
    setLoading(false)
  }, [ticketId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const createComment = useCallback(
    async (body, userId) => {
      // Rate limiting (20/hour) and visibility are enforced server-side by
      // the BEFORE INSERT trigger and RLS policy respectively (see
      // supabase/migrations.sql section 7) - this is a plain insert, not an
      // RPC, because there's no duplicate-guard or honeypot logic that needs
      // procedural code the way ticket creation does.
      const { data, error } = await supabase
        .from('ticket_comments')
        .insert({ ticket_id: ticketId, user_id: userId, body })
        .select('*, author:profiles(full_name, role)')
        .single()
      if (error) throw error
      setComments((prev) => [...prev, data])
      return data
    },
    [ticketId]
  )

  return { comments, loading, refetch: fetchComments, createComment }
}
