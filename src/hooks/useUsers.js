import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    // profiles_select_any_authenticated (0001_init.sql section 5) already
    // lets any authenticated user read every profile - this page's own
    // access is what's restricted (adminOnly route), not the underlying
    // read. See supabase/migrations/0002_role_tiers.sql for why role
    // changes themselves still require the set_user_role() RPC below.
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .order('created_at', { ascending: true })

    if (!error) setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const changeRole = useCallback(async (targetUserId, newRole) => {
    const { data, error } = await supabase.rpc('set_user_role', {
      p_target_user_id: targetUserId,
      p_new_role: newRole,
    })
    if (error) throw error
    setUsers((prev) => prev.map((u) => (u.id === targetUserId ? data : u)))
    return data
  }, [])

  // Server-side: delete_user_account() re-verifies the caller is an admin,
  // refuses self-deletion, writes the account_deletions audit row, and
  // deletes auth.users (cascading everything the user owned) - see
  // supabase/migrations/0006_account_deletion.sql.
  const deleteUser = useCallback(async (targetUserId) => {
    const { error } = await supabase.rpc('delete_user_account', {
      p_target_user_id: targetUserId,
    })
    if (error) throw error
    setUsers((prev) => prev.filter((u) => u.id !== targetUserId))
  }, [])

  return { users, loading, refetch: fetchUsers, changeRole, deleteUser }
}
