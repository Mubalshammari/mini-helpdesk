import { useMemo, useState } from 'react'
import { MagnifyingGlass, Trash } from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useUsers } from '../hooks/useUsers'
import { usePageTitle } from '../hooks/usePageTitle'
import { useRefreshable } from '../context/RefreshContext'
import Avatar from '../components/ui/Avatar'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { ROLES, ROLE_LABELS } from '../lib/constants'
import { formatDate } from '../lib/format'

const selectClasses =
  'rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-medium text-stone-700 transition-colors hover:border-stone-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200'

export default function ManageUsersPage() {
  usePageTitle('Manage users')
  const { user } = useAuth()
  const { showToast } = useToast()
  const { users, loading, refetch, changeRole, deleteUser } = useUsers()
  useRefreshable('users', refetch)
  const [search, setSearch] = useState('')
  const [pendingChange, setPendingChange] = useState(null) // { targetUser, newRole }
  const [pendingDelete, setPendingDelete] = useState(null) // targetUser

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => (u.full_name || '').toLowerCase().includes(q))
  }, [users, search])

  async function handleConfirm() {
    const { targetUser, newRole } = pendingChange
    try {
      await changeRole(targetUser.id, newRole)
      showToast(`${targetUser.full_name || 'User'} is now ${ROLE_LABELS[newRole]}.`, 'success')
    } catch (err) {
      showToast(err.message ?? 'Could not change this user’s role.', 'error')
    } finally {
      setPendingChange(null)
    }
  }

  async function handleDeleteConfirm() {
    const targetUser = pendingDelete
    try {
      await deleteUser(targetUser.id)
      showToast(`${targetUser.full_name || 'User'}'s account was deleted.`, 'success')
    } catch (err) {
      showToast(err.message ?? 'Could not delete this account.', 'error')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <AppShell>
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Change who has IT or admin access. Every change is recorded in the role history.
      </p>

      <div className="mt-5 relative max-w-sm">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name"
          className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500 dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-4">
                    <div className="h-4 w-full animate-pulse rounded bg-stone-100 dark:bg-stone-700" />
                  </td>
                </tr>
              ))}

            {!loading &&
              filtered.map((u) => {
                const isSelf = u.id === user.id
                // Mirrors the server rule in delete_user_account(): admins
                // can't be deleted directly - demote first. Disabling the
                // button here means the UI never offers an action the RPC
                // would reject.
                const isAdminTarget = u.role === 'admin'
                const deleteDisabled = isSelf || isAdminTarget
                const deleteTitle = isSelf
                  ? "You can't delete your own account."
                  : isAdminTarget
                    ? 'Change this admin to employee or IT first, then delete.'
                    : 'Delete account'
                return (
                  <tr key={u.id} className="transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.full_name} size={24} />
                        <span className="text-stone-700 dark:text-stone-300">{u.full_name || 'Unnamed user'}</span>
                        {isSelf && (
                          <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-700 dark:text-stone-400">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-500 dark:text-stone-400">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={isSelf}
                        title={isSelf ? "You can't change your own role." : undefined}
                        onChange={(e) => setPendingChange({ targetUser: u, newRole: e.target.value })}
                        className={selectClasses}
                        aria-label={`Change role for ${u.full_name || 'user'}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={deleteDisabled}
                        onClick={() => setPendingDelete(u)}
                        aria-label={`Delete ${u.full_name || 'user'}'s account`}
                        title={deleteTitle}
                        className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-stone-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                      >
                        <Trash size={15} weight="regular" />
                      </button>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>

        {!loading && filtered.length === 0 && (
          <EmptyState icon={MagnifyingGlass} title="No users match" description="Try a different search term." />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingChange)}
        onCancel={() => setPendingChange(null)}
        onConfirm={handleConfirm}
        title={
          pendingChange
            ? `Make ${pendingChange.targetUser.full_name || 'this user'} ${ROLE_LABELS[pendingChange.newRole]}?`
            : ''
        }
        description={
          pendingChange?.newRole === 'admin'
            ? 'Admins can manage every user’s role, including granting or revoking admin access.'
            : 'This takes effect immediately.'
        }
        confirmLabel="Change role"
        variant={pendingChange?.newRole === 'admin' ? 'danger' : 'primary'}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteConfirm}
        title={pendingDelete ? `Permanently delete ${pendingDelete.full_name || 'this user'}'s account?` : ''}
        description="Their login, every ticket they filed, and every reply they wrote are deleted permanently. A record of the deletion (who, when) is kept in the audit log. This cannot be undone."
        confirmLabel="Delete account"
        variant="danger"
      />
    </AppShell>
  )
}
