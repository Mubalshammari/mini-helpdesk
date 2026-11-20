import Assignment from '../components/tickets/Assignment'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CaretRight,
  PencilSimple,
  MagnifyingGlassMinus,
  ChatCircleDots,
} from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTicket } from '../hooks/useTicket'
import { useComments } from '../hooks/useComments'
import { usePageTitle } from '../hooks/usePageTitle'
import { useRefresh } from '../context/RefreshContext'
import { STATUS_META } from '../components/ui/StatusBadge'
import { PRIORITY_META } from '../components/ui/PriorityIcon'
import PriorityIcon from '../components/ui/PriorityIcon'
import StatusPills from '../components/tickets/StatusPills'
import PriorityPills from '../components/tickets/PriorityPills'
import StatusTimeline from '../components/tickets/StatusTimeline'
import EditTicketModal from '../components/tickets/EditTicketModal'
import CommentThread from '../components/tickets/CommentThread'
import CommentComposer from '../components/tickets/CommentComposer'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import { TicketDetailSkeleton } from '../components/ui/Skeleton'
import { CATEGORY_LABELS } from '../lib/constants'
import { formatDateTime } from '../lib/format'

export default function TicketDetailPage() {
  const { id } = useParams()
  return (
    <AppShell>
      <TicketDetail key={id} id={id} />
    </AppShell>
  )
}

export function TicketDetail({ id, embedded = false }) {
  const navigate = useNavigate()
  const { user, isStaff } = useAuth()
  const { showToast } = useToast()
  const { refresh } = useRefresh()
  const { ticket, error, loading, notFound, refetch, updateTicket } = useTicket(id)
  const {
    comments,
    loading: commentsLoading,
    error: commentsError,
    refresh: refetchComments,
    createComment,
  } = useComments(id)
  const [editOpen, setEditOpen] = useState(false)
  const [pendingChange, setPendingChange] = useState(null) // { field: 'status' | 'priority', value }
  usePageTitle(ticket?.title ?? 'Ticket')

  const isOwner = ticket?.user_id === user?.id
  const canEdit = isOwner && ticket?.status === 'open'

  async function handleReply(body) {
    await createComment(body, user.id)
    await refresh()
  }

  async function handleSave(patch) {
    await updateTicket(patch)
    showToast('Ticket updated.', 'success')
  }

  async function handleChangeConfirm() {
    const { field, value } = pendingChange
    setPendingChange(null)
    try {
      await updateTicket({ [field]: value })
      showToast(field === 'status' ? 'Status updated.' : 'Priority updated.', 'success')
    } catch (err) {
      showToast(err.message ?? `Could not update the ${field}.`, 'error')
    }
  }

  const pendingLabel = pendingChange
    ? pendingChange.field === 'status'
      ? STATUS_META[pendingChange.value].label
      : PRIORITY_META[pendingChange.value].label
    : ''

  return (
    <article className="ticket-detail">
      {!embedded && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
          >
            <ArrowLeft size={15} weight="bold" />
          </button>
          <Link
            to="/tickets"
            className="font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          >
            Tickets
          </Link>
          <CaretRight size={12} weight="bold" className="shrink-0 text-stone-300 dark:text-stone-600" />
          <span className="max-w-[18rem] truncate font-medium text-stone-900 dark:text-stone-100">
            {loading ? '…' : (ticket?.title ?? 'Not found')}
          </span>
        </nav>
      )}

      <div className="mt-6">
        {loading && <TicketDetailSkeleton />}
        {error && (
          <p role="alert" className="notice">
            Couldn’t load this ticket. <button onClick={refetch}>Try again</button>
          </p>
        )}

        {!loading && notFound && (
          <EmptyState
            icon={MagnifyingGlassMinus}
            title="Ticket not found"
            description="This ticket doesn't exist, or you don't have access to it."
          />
        )}

        {!loading && ticket && (
          <>
            <div className="rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-semibold leading-snug text-stone-900 dark:text-stone-100">
                  {ticket.title}
                </h1>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    aria-label="Edit ticket"
                    className="shrink-0 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-700 dark:hover:text-stone-300"
                  >
                    <PencilSimple size={16} weight="regular" />
                  </button>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-400 dark:text-stone-500">
                <span>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
                <PriorityIcon priority={ticket.priority} />
                <span>Opened {formatDateTime(ticket.created_at)}</span>
                {ticket.updated_at !== ticket.created_at && (
                  <span>Updated {formatDateTime(ticket.updated_at)}</span>
                )}
              </div>

              <Assignment ticket={ticket} />

              {/* Staff act on the pills; everyone else reads the same pills.
                  One component, one visual language for status across roles. */}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <StatusPills
                  status={ticket.status}
                  readOnly={!isStaff}
                  onSelect={(value) => setPendingChange({ field: 'status', value })}
                />
                {isStaff && (
                  <PriorityPills
                    priority={ticket.priority}
                    onSelect={(value) => setPendingChange({ field: 'priority', value })}
                  />
                )}
              </div>

              <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                {ticket.description}
              </p>

              <div className="mt-8 border-t border-stone-100 pt-6 dark:border-stone-700">
                <StatusTimeline status={ticket.status} />
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-stone-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-800">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                <ChatCircleDots size={17} weight="regular" />
                Replies
              </h2>

              <div className="mt-4">
                {commentsError ? (
                  <p role="alert" className="notice">
                    Couldn’t load replies. <button onClick={refetchComments}>Try again</button>
                  </p>
                ) : commentsLoading ? (
                  <div className="space-y-3">
                    <div className="h-16 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-700" />
                    <div className="h-16 animate-pulse rounded-lg bg-stone-100 dark:bg-stone-700" />
                  </div>
                ) : (
                  <CommentThread comments={comments} />
                )}
              </div>

              <div className="mt-6 border-t border-stone-100 pt-6 dark:border-stone-700">
                <CommentComposer onSubmit={handleReply} />
              </div>
            </div>

            {editOpen && (
              <EditTicketModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                ticket={ticket}
                onSave={handleSave}
              />
            )}

            <ConfirmDialog
              open={Boolean(pendingChange)}
              onCancel={() => setPendingChange(null)}
              onConfirm={handleChangeConfirm}
              title={pendingChange ? `Change ${pendingChange.field} to "${pendingLabel}"?` : ''}
              description="This applies immediately. Reply on the thread if the requester should know why."
              confirmLabel="Apply change"
            />
          </>
        )}
      </div>
    </article>
  )
}
