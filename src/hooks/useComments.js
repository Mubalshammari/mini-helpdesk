import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useWorkspaceQuery } from './useWorkspaceQuery'

export function useComments(ticketId) {
  const read = useCallback(
    () =>
      supabase
        .from('ticket_comments')
        .select('*, author:profiles(full_name, role)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
        .order('id'),
    [ticketId]
  )
  const { data, error, refresh } = useWorkspaceQuery('ticket-comments', read)

  async function createComment(body, userId) {
    const result = await supabase
      .from('ticket_comments')
      .insert({ ticket_id: ticketId, user_id: userId, body })
    if (result.error) throw result.error
  }

  return { comments: data || [], loading: data === undefined && !error, error, refresh, createComment }
}
