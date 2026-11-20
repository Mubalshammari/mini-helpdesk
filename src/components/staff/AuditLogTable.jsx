import { Link } from 'react-router-dom'
import { ArrowRight, Fingerprint, Key, Ticket, UserMinus } from '@phosphor-icons/react'
import EmptyState from '../ui/EmptyState'
import { formatDate, formatDateTime } from '../../lib/format'
import { ROLE_LABELS } from '../../lib/constants'

const labels = {
  assigned_to_changed: 'Assignment changed',
  status_changed: 'Status changed',
  priority_changed: 'Priority changed',
  title_changed: 'Title edited',
  description_changed: 'Description edited',
  role_changed: 'Access changed',
  account_deleted: 'Account removed',
}
const icons = { ticket: Ticket, access: Key, account: UserMinus }

function displayValue(action, value) {
  if (value == null) return '—'
  if (action === 'role_changed' || action === 'account_deleted') return ROLE_LABELS[value] || value
  return action === 'status_changed' ? value.replaceAll('_', ' ') : value
}

export default function AuditLogTable({ entries, filtered }) {
  if (!entries.length)
    return (
      <EmptyState
        icon={Fingerprint}
        title={filtered ? 'No matching activity' : 'No activity yet'}
        description={
          filtered
            ? 'Try another name, change type or date range.'
            : 'Recorded changes will appear here.'
        }
      />
    )

  const groups = new Map()
  for (const entry of entries) {
    const day = formatDate(entry.created_at)
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day).push(entry)
  }
  return (
    <div className="history-stream">
      {Array.from(groups, ([day, events]) => (
        <section key={day} aria-label={day}>
          <h2>{day}</h2>
          <ol>
            {events.map((event) => {
              const Icon = icons[event.kind] ?? Fingerprint
              const longEdit = event.action === 'description_changed' || event.action === 'title_changed'
              const values = (
                <div className="history-values">
                  <span>{displayValue(event.action, event.before)}</span>
                  {event.after !== null && (
                    <>
                      <ArrowRight size={13} aria-label="changed to" />
                      <strong>{displayValue(event.action, event.after)}</strong>
                    </>
                  )}
                </div>
              )
              return (
                <li key={event.kind + event.id}>
                  <div className={'history-marker ' + event.kind}>
                    <Icon aria-hidden="true" size={19} />
                  </div>
                  <div className="history-body">
                    <div className="history-line">
                      <strong>{labels[event.action] || event.action.replaceAll('_', ' ')}</strong>
                      <time dateTime={event.created_at} title={formatDateTime(event.created_at)}>
                        {new Date(event.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <p>
                      {event.ticket_id ? (
                        <Link to={'/tickets/' + event.ticket_id}>{event.subject}</Link>
                      ) : (
                        <b>{event.subject}</b>
                      )}
                      <span> · {event.actor}</span>
                    </p>
                    {longEdit ? (
                      <details>
                        <summary>View edit</summary>
                        {values}
                      </details>
                    ) : (
                      values
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
