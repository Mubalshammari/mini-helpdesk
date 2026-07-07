import Avatar from '../ui/Avatar'
import { formatRelative } from '../../lib/format'

export default function CommentThread({ comments }) {
  if (comments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">
        No replies yet.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-5">
      {comments.map((comment) => {
        const isStaff = comment.author?.role === 'it' || comment.author?.role === 'admin'
        return (
          <li key={comment.id} className="flex gap-3">
            <Avatar name={comment.author?.full_name} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {comment.author?.full_name || 'Unknown user'}
                </span>
                {isStaff && (
                  <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    IT Support
                  </span>
                )}
                <time
                  dateTime={comment.created_at}
                  title={new Date(comment.created_at).toLocaleString()}
                  className="text-xs text-stone-400 dark:text-stone-500"
                >
                  {formatRelative(comment.created_at)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                {comment.body}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
