import { STATUS_META } from '../ui/StatusBadge'
import { STATUSES } from '../../lib/constants'

export default function StatusTimeline({ status }) {
  const current = STATUSES.indexOf(status)
  return (
    <ol className="case-stages" aria-label="Ticket progress">
      {STATUSES.map((value, index) => (
        <li
          key={value}
          className={index <= current ? 'reached' : undefined}
          aria-current={value === status ? 'step' : undefined}
        >
          {STATUS_META[value].label}
        </li>
      ))}
    </ol>
  )
}
