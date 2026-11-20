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
  const { users, loading, error, refetch, changeRole, deleteUser } = useUsers()
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
      <div className="page-intro">
        <h1>Team directory</h1>
        <p>Change who has IT or admin access. Every change is recorded in the role history.</p>
      </div>

      <div className="mt-5 relative max-w-sm">
        <MagnifyingGlass
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search team members"
          placeholder="Search by name"
          className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
        />
      </div>

      <section className="people-grid" aria-label="Team members">
        {loading && <p role="status">Loading team members…</p>}
        {error && (
          <p role="alert">
            Couldn’t load the directory. <button onClick={refetch}>Try again</button>
          </p>
        )}
        {!loading &&
          !error &&
          filtered.map((member) => {
            const self = member.id === user.id
            const protectedAccount = self || member.role === 'admin'
            return (
              <article className="sheet person-card" key={member.id}>
                <div className="person-heading">
                  <Avatar name={member.full_name} size={40} />
                  <div>
                    <h2>{member.full_name || 'Unnamed user'}</h2>
                    <small>Joined {formatDate(member.created_at)}</small>
                  </div>
                </div>
                <div className="person-controls">
                  <select
                    value={member.role}
                    className={selectClasses}
                    disabled={self}
                    aria-label={'Change role for ' + member.full_name}
                    onChange={(event) =>
                      setPendingChange({ targetUser: member, newRole: event.target.value })
                    }
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={protectedAccount}
                    aria-label={'Delete account for ' + member.full_name}
                    title={protectedAccount ? 'This account is protected' : 'Delete account'}
                    onClick={() => setPendingDelete(member)}
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </article>
            )
          })}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={MagnifyingGlass}
            title="No users match"
            description="Try a different name."
          />
        )}
      </section>

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
        title={
          pendingDelete ? `Permanently delete ${pendingDelete.full_name || 'this user'}'s account?` : ''
        }
        description="Their login, every ticket they filed, and every reply they wrote are deleted permanently. A record of the deletion (who, when) is kept in the audit log. This cannot be undone."
        confirmLabel="Delete account"
        variant="danger"
      />
    </AppShell>
  )
}
