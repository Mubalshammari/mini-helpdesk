import { useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChatCircleDots,
  CopySimple,
  LockKey,
  MagnifyingGlassMinus,
  PencilSimple,
  Ticket,
} from '@phosphor-icons/react'
import AppShell from '../components/layout/AppShell'
import Assignment from '../components/tickets/Assignment'
import CommentComposer from '../components/tickets/CommentComposer'
import CommentThread from '../components/tickets/CommentThread'
import EditTicketModal from '../components/tickets/EditTicketModal'
import PriorityPills from '../components/tickets/PriorityPills'
import StaffNotes from '../components/tickets/StaffNotes'
import StatusPills from '../components/tickets/StatusPills'
import StatusTimeline from '../components/tickets/StatusTimeline'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import EmptyState from '../components/ui/EmptyState'
import PriorityIcon, { PRIORITY_META } from '../components/ui/PriorityIcon'
import StatusBadge, { STATUS_META } from '../components/ui/StatusBadge'
import { TicketDetailSkeleton } from '../components/ui/Skeleton'
import { useAuth } from '../context/AuthContext'
import { useRefresh } from '../context/RefreshContext'
import { useToast } from '../context/ToastContext'
import { useComments } from '../hooks/useComments'
import { usePageTitle } from '../hooks/usePageTitle'
import { useTicket } from '../hooks/useTicket'
import { CATEGORY_LABELS } from '../lib/constants'
import { formatDateTime, formatRelative } from '../lib/format'
import '../ticket-experience.css'

export default function TicketDetailPage() {
  const { id } = useParams()
  return (
    <AppShell>
      <TicketDetail key={id} id={id} />
    </AppShell>
  )
}

export function TicketDetail({ id, embedded = false }) {
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
  const [pendingChange, setPendingChange] = useState(null)
  const [activeTab, setActiveTab] = useState('replies')
  const [notesOpened, setNotesOpened] = useState(false)
  const navigate = useNavigate()
  const tabPrefix = useId()
  usePageTitle(ticket?.title ?? 'Ticket')

  function activate(tab) {
    setActiveTab(tab)
    if (tab === 'notes') setNotesOpened(true)
  }

  function moveTab(event) {
    const targets = {
      ArrowLeft: activeTab === 'replies' ? 'notes' : 'replies',
      ArrowRight: activeTab === 'replies' ? 'notes' : 'replies',
      Home: 'replies',
      End: 'notes',
    }
    const target = targets[event.key]
    if (!target) return
    event.preventDefault()
    activate(target)
    document.getElementById(tabPrefix + '-' + target)?.focus()
  }

  async function handleReply(body) {
    await createComment(body, user.id)
    await refresh()
  }

  async function handleSave(patch) {
    await updateTicket(patch)
    showToast('Ticket updated.', 'success')
  }

  async function confirmChange() {
    const { field, value } = pendingChange
    setPendingChange(null)
    try {
      await updateTicket({ [field]: value })
      showToast(field === 'status' ? 'Status updated.' : 'Priority updated.', 'success')
    } catch (err) {
      showToast(err.message || 'Could not update the ticket.', 'error')
    }
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(id)
      showToast('Ticket ID copied.', 'success')
    } catch {
      showToast('Could not access the clipboard.', 'error')
    }
  }

  const pendingLabel =
    pendingChange &&
    (pendingChange.field === 'status' ? STATUS_META : PRIORITY_META)[pendingChange.value].label
  const canEdit = ticket?.user_id === user?.id && ticket?.status === 'open'
  const repliesVisible = !isStaff || activeTab === 'replies'
  return (
    <article className={'case-file' + (embedded ? ' case-file-inline' : '')}>
      {!embedded && (
        <nav aria-label="Breadcrumb" className="case-crumb">
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft size={16} />
          </button>
          <Link to="/tickets">Tickets</Link>
          <span aria-hidden="true">/</span>
          <span>Request details</span>
        </nav>
      )}
      {loading && <TicketDetailSkeleton />}
      {error && (
        <p className="notice" role="alert">
          Couldn’t load this ticket. <button onClick={refetch}>Try again</button>
        </p>
      )}
      {!loading && notFound && (
        <EmptyState
          icon={MagnifyingGlassMinus}
          title="Ticket not found"
          description="This ticket is unavailable."
        />
      )}
      {ticket && (
        <>
          <section className="case-summary" aria-label="Ticket overview">
            <div className="case-reference-row">
              <button
                type="button"
                className="case-reference"
                title="Copy full ticket ID"
                aria-label="Copy full ticket ID"
                onClick={copyReference}
              >
                <Ticket size={15} />
                <span>#{id.slice(0, 8).toUpperCase()}</span>
                <CopySimple size={13} />
              </button>
              <StatusBadge status={ticket.status} size="sm" />
            </div>
            <div className="case-title">
              <h1>{ticket.title}</h1>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  aria-label="Edit ticket"
                  title="Edit ticket"
                >
                  <PencilSimple size={17} />
                </button>
              )}
            </div>
            <div className="case-meta">
              <span>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
              <PriorityIcon priority={ticket.priority} />
              <time dateTime={ticket.created_at} title={formatDateTime(ticket.created_at)}>
                Opened {formatRelative(ticket.created_at)}
              </time>
            </div>
            <p className="case-description">{ticket.description}</p>
            <Assignment ticket={ticket} />
            {isStaff ? (
              <div className="case-routing">
                <div>
                  <p>Status</p>
                  <StatusPills
                    status={ticket.status}
                    onSelect={(value) => setPendingChange({ field: 'status', value })}
                  />
                </div>
                <div>
                  <p>Priority</p>
                  <PriorityPills
                    priority={ticket.priority}
                    onSelect={(value) => setPendingChange({ field: 'priority', value })}
                  />
                </div>
              </div>
            ) : (
              <StatusTimeline status={ticket.status} />
            )}
          </section>

          <section className="case-conversation" aria-label="Ticket conversation">
            {isStaff ? (
              <div
                className="case-switch"
                role="tablist"
                aria-label="Conversation visibility"
                onKeyDown={moveTab}
              >
                {['replies', 'notes'].map((tab) => (
                  <button
                    type="button"
                    role="tab"
                    id={tabPrefix + '-' + tab}
                    key={tab}
                    aria-controls={tabPrefix + '-' + tab + '-panel'}
                    tabIndex={activeTab === tab ? 0 : -1}
                    aria-selected={activeTab === tab}
                    onClick={() => activate(tab)}
                  >
                    {tab === 'replies' ? <ChatCircleDots size={17} /> : <LockKey size={17} />}
                    {tab === 'replies' ? 'Replies' : 'Internal notes'}
                  </button>
                ))}
              </div>
            ) : (
              <h2 className="conversation-title">
                <ChatCircleDots size={19} /> Replies
              </h2>
            )}
            <div
              hidden={!repliesVisible}
              className="conversation-panel"
              id={tabPrefix + '-replies-panel'}
              role={isStaff ? 'tabpanel' : undefined}
              aria-labelledby={isStaff ? tabPrefix + '-replies' : undefined}
            >
              {commentsError ? (
                <p role="alert" className="notice">
                  Couldn’t load replies. <button onClick={refetchComments}>Try again</button>
                </p>
              ) : commentsLoading ? (
                <p className="conversation-empty" role="status">
                  Loading replies…
                </p>
              ) : (
                <CommentThread comments={comments} />
              )}
              <CommentComposer onSubmit={handleReply} />
            </div>
            {isStaff && (
              <div
                className="case-notes"
                role="tabpanel"
                hidden={activeTab !== 'notes'}
                id={tabPrefix + '-notes-panel'}
                aria-labelledby={tabPrefix + '-notes'}
              >
                {notesOpened && <StaffNotes ticketId={id} />}
              </div>
            )}
          </section>

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
            onConfirm={confirmChange}
            title={pendingChange ? `Change ${pendingChange.field} to "${pendingLabel}"?` : ''}
            description="The change is visible to the requester and recorded in the audit trail."
            confirmLabel="Apply change"
          />
        </>
      )}
    </article>
  )
}
