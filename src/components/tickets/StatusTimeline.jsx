import { Check } from '@phosphor-icons/react'
import { STATUS_META } from '../ui/StatusBadge'
import { STATUSES } from '../../lib/constants'

// A generic lifecycle stepper (open -> in_progress -> resolved -> closed),
// not a literal log of what happened when. It's derived entirely from the
// ticket's current status column, which any viewer with row access already
// has. The real per-change audit trail (who changed what, when) lives in
// ticket_history, which is admin-only per RLS (see supabase/migrations.sql
// section 8) - that full log gets its own admin-only viewer in Phase 4.
// This is "where the ticket is now," not "everything that happened to it."
export default function StatusTimeline({ status }) {
  const currentIndex = STATUSES.indexOf(status)

  return (
    <ol className="flex items-center">
      {STATUSES.map((step, index) => {
        const meta = STATUS_META[step]
        const isComplete = index < currentIndex
        const isCurrent = index === currentIndex
        const isLast = index === STATUSES.length - 1

        return (
          <li key={step} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-offset-2 ring-offset-white transition-colors dark:ring-offset-stone-900 ${
                  isComplete
                    ? 'bg-indigo-600 text-white ring-indigo-600'
                    : isCurrent
                      ? 'bg-white text-indigo-600 ring-indigo-600 dark:bg-stone-800'
                      : 'bg-white text-stone-300 ring-stone-200 dark:bg-stone-800 dark:text-stone-600 dark:ring-stone-700'
                }`}
              >
                {isComplete ? <Check size={13} weight="bold" /> : index + 1}
              </div>
              <span
                className={`whitespace-nowrap text-xs font-medium ${
                  isCurrent
                    ? 'text-stone-900 dark:text-stone-100'
                    : isComplete
                      ? 'text-stone-500 dark:text-stone-400'
                      : 'text-stone-300 dark:text-stone-600'
                }`}
              >
                {meta.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-2 h-0.5 flex-1 rounded-full transition-colors ${
                  isComplete ? 'bg-indigo-600' : 'bg-stone-200 dark:bg-stone-700'
                }`}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
