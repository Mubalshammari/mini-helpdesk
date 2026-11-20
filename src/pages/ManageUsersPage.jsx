import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  MagnifyingGlass,
  SlidersHorizontal,
  Trash,
  UsersThree,
} from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useUsers, DIRECTORY_PAGE_SIZE } from '../hooks/useUsers'
import { usePageTitle } from '../hooks/usePageTitle'
import { ROLES, ROLE_LABELS } from '../lib/constants'
import { formatDate } from '../lib/format'
import './directory.css'

function describeRoleChange(role) {
  if (role === 'admin') return 'This person will be able to manage team access and delete accounts.'
  if (role === 'employee')
    return 'Their assigned tickets return to the queue. This person keeps access to requests they submitted.'
  return 'This person will be able to claim and manage support tickets. Only administrators can change team access.'
}

const firstPage = { name: '', role: '', page: 1 }

export default function ManageUsersPage() {
  usePageTitle('Team directory')
  const { user } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [filters, setFilters] = useState(firstPage)
  const [pendingChange, setPendingChange] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const { data, error, refresh, changeRole, deleteUser } = useUsers(filters)
  const hasFilters = Boolean(filters.role || filters.name)
  const page = filters.page
  const start = (page - 1) * DIRECTORY_PAGE_SIZE

  useEffect(() => {
    const term = name.trim()
    if (term === filters.name) return
    const timer = window.setTimeout(
      () => setFilters((current) => ({ ...current, name: term, page: 1 })),
      200
    )
    return () => window.clearTimeout(timer)
  }, [name, filters.name])

  // A deletion or role change may remove the last member on this page.
  useEffect(() => {
    if (data && page > 1 && start >= data.total) {
      setFilters((current) => ({
        ...current,
        page: Math.max(1, Math.ceil(data.total / DIRECTORY_PAGE_SIZE)),
      }))
    }
  }, [data, page, start])

  function resetFilters() {
    setName('')
    setFilters(firstPage)
  }

  async function confirmRoleChange() {
    const { member, role } = pendingChange
    try {
      await changeRole(member.id, role)
      showToast(`${member.full_name || 'Member'} now has ${ROLE_LABELS[role]} access.`, 'success')
    } catch (error) {
      showToast(error.message || 'Could not change this member’s access.', 'error')
    } finally {
      setPendingChange(null)
    }
  }

  async function confirmDeletion() {
    try {
      await deleteUser(pendingDelete.id)
      showToast('Account deleted.', 'success')
    } catch (error) {
      showToast(error.message || 'Could not delete this account.', 'error')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <AppShell>
      <div className="page-intro directory-intro">
        <h1>Team directory</h1>
        <p>Find a colleague and manage their access to the support desk.</p>
      </div>
      <section className="sheet directory-panel" aria-label="Team members">
        <div className="directory-filters">
          <label className="directory-search">
            <MagnifyingGlass size={19} aria-hidden="true" />
            <input
              type="search"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Search by name"
              aria-label="Search team members"
            />
          </label>
          <label className="directory-role-filter">
            <SlidersHorizontal size={17} aria-hidden="true" />
            <select
              aria-label="Filter by role"
              value={filters.role}
              onChange={(event) => setFilters({ name: name.trim(), role: event.target.value, page: 1 })}
            >
              <option value="">All roles</option>
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? (
          <div className="directory-message" role="alert">
            <p>Couldn’t load the directory.</p>
            <Button variant="secondary" size="sm" onClick={refresh}>
              Try again
            </Button>
          </div>
        ) : !data ? (
          <p className="directory-message" role="status">
            Loading team members…
          </p>
        ) : data.total === 0 ? (
          <div className="directory-empty">
            <EmptyState
              icon={hasFilters ? MagnifyingGlass : UsersThree}
              title={hasFilters ? 'No matching members' : 'No team members yet'}
              description={
                hasFilters ? 'Try another name or role.' : 'Accounts appear here after sign-up.'
              }
              action={
                hasFilters && (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Clear filters
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            <table className="directory-table">
              <caption className="sr-only">Team members, access roles and account actions</caption>
              <thead>
                <tr>
                  <th scope="col">Team member</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Access role</th>
                  <th scope="col">
                    <span className="sr-only">Account actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((member) => {
                  const self = member.id === user.id
                  const label = member.full_name || 'Unnamed member'
                  const protectedAccount = self || member.role === 'admin'
                  return (
                    <tr key={member.id}>
                      <th scope="row">
                        <div className="directory-person">
                          <Avatar name={member.full_name} size={36} />
                          <div>
                            <strong>{label}</strong>
                            {self && <span>Your account</span>}
                          </div>
                        </div>
                      </th>
                      <td className="directory-joined">
                        <time dateTime={member.created_at}>{formatDate(member.created_at)}</time>
                      </td>
                      <td className="directory-access">
                        <select
                          aria-label={'Change role for ' + label}
                          value={member.role}
                          disabled={self}
                          onChange={(event) => setPendingChange({ member, role: event.target.value })}
                        >
                          {ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="directory-actions">
                        <button
                          type="button"
                          disabled={protectedAccount}
                          title={
                            self
                              ? 'Your own account is protected'
                              : protectedAccount
                                ? 'Change the administrator role before deleting this account'
                                : 'Delete account'
                          }
                          aria-label={'Delete account for ' + label}
                          onClick={() => setPendingDelete(member)}
                        >
                          <Trash size={18} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <nav className="directory-pagination" aria-label="Directory pages">
              <p aria-live="polite">
                {start + 1}–{Math.min(start + data.members.length, data.total)} of {data.total}{' '}
                {data.total === 1 ? 'member' : 'members'}
              </p>
              <div>
                <button
                  type="button"
                  aria-label="Previous directory page"
                  disabled={page === 1}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
                >
                  <ArrowLeft />
                </button>
                <button
                  type="button"
                  aria-label="Next directory page"
                  disabled={start + DIRECTORY_PAGE_SIZE >= data.total}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                >
                  <ArrowRight />
                </button>
              </div>
            </nav>
          </>
        )}
      </section>
      <ConfirmDialog
        open={Boolean(pendingChange)}
        onCancel={() => setPendingChange(null)}
        onConfirm={confirmRoleChange}
        title={
          pendingChange
            ? `Give ${pendingChange.member.full_name || 'this member'} ${ROLE_LABELS[pendingChange.role]} access?`
            : ''
        }
        description={pendingChange ? describeRoleChange(pendingChange.role) : ''}
        confirmLabel="Change role"
        variant={pendingChange?.role === 'admin' ? 'danger' : 'primary'}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDeletion}
        title={
          pendingDelete
            ? `Permanently delete ${pendingDelete.full_name || 'this member'}’s account?`
            : ''
        }
        description="This deletes their login, submitted tickets and replies. Tickets assigned to them return to the queue. The deletion is recorded in the audit trail."
        confirmLabel="Delete account"
        variant="danger"
      />
    </AppShell>
  )
}
