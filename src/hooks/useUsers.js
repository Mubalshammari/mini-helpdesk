import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useWorkspaceQuery } from './useWorkspaceQuery'

export const DIRECTORY_PAGE_SIZE = 12

export function useUsers({ name, role, page }) {
  const read = useCallback(async () => {
    const start = (page - 1) * DIRECTORY_PAGE_SIZE
    let query = supabase
      .from('profiles')
      .select('id, full_name, role, created_at', { count: 'exact' })
      .order('full_name')
      .order('id')
      .range(start, start + DIRECTORY_PAGE_SIZE - 1)

    if (role) query = query.eq('role', role)
    // Postgres's literal regex prefix keeps names containing *, %, _, or backslashes searchable.
    if (name) query = query.filter('full_name', 'imatch', '***=' + name)

    const { data, error, count } = await query
    if (page > 1 && error?.code === 'PGRST103') return { data: { members: [], total: 0 } }
    if (error) return { error }
    return { data: { members: data, total: count ?? data.length } }
  }, [name, role, page])

  const { data, error, refresh } = useWorkspaceQuery('team-directory', read)

  async function changeRole(memberId, newRole) {
    const result = await supabase.rpc('set_user_role', {
      p_target_user_id: memberId,
      p_new_role: newRole,
    })
    if (result.error) throw result.error
    await refresh()
  }

  async function deleteUser(memberId) {
    const result = await supabase.rpc('delete_user_account', { p_target_user_id: memberId })
    if (result.error) throw result.error
    await refresh()
  }

  return { data, error, refresh, changeRole, deleteUser }
}
