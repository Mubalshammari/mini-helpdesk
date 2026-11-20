import Avatar from '../ui/Avatar'
import { formatDateTime, formatRelative } from '../../lib/format'

export default function CommentThread({ comments }) {
  if (!comments.length) return <p className="conversation-empty">No replies yet. Add an update below.</p>
  return (
    <ol className="conversation-feed" aria-label="Ticket replies">
      {comments.map((comment) => {
        const support = ['it', 'admin'].includes(comment.author?.role)
        return (
          <li key={comment.id} className="conversation-entry">
            <Avatar name={comment.author?.full_name} size={32} />
            <div className="conversation-message">
              <div className="conversation-byline">
                <strong>{comment.author?.full_name || 'Former user'}</strong>
                {support && <span>IT support</span>}
                <time dateTime={comment.created_at} title={formatDateTime(comment.created_at)}>
                  {formatRelative(comment.created_at)}
                </time>
              </div>
              <p>{comment.body}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
