import { useCallback } from 'react'
import { useRefresh } from '../context/RefreshContext'
import { supabase } from '../lib/supabaseClient'
import { useWorkspaceQuery } from './useWorkspaceQuery'

const fields = '*, assignee:profiles!assigned_to(full_name)'

export function useTicket(ticketId) {
  const workspace = useRefresh()
  const read = useCallback(
    () => supabase.from('tickets').select(fields).eq('id', ticketId).maybeSingle(),
    [ticketId]
  )
  const { data, error, refresh } = useWorkspaceQuery('ticket', read)

  async function updateTicket(patch) {
    const result = await supabase.from('tickets').update(patch).eq('id', ticketId).select('id').single()
    if (result.error) throw result.error
    await workspace.refresh()
  }

  return {
    ticket: data,
    error,
    loading: data === undefined && !error,
    notFound: data === null,
    refetch: refresh,
    updateTicket,
  }
}
