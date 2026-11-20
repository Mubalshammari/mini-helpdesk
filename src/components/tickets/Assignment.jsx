import { useState } from 'react'
import { HandPalm } from '@phosphor-icons/react'
import { useRefresh } from '../../context/RefreshContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabaseClient'

export default function Assignment({ ticket }) {
  const { user, isStaff } = useAuth()
  const { refresh } = useRefresh()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const available = !ticket.assigned_to && ['open', 'in_progress'].includes(ticket.status)
  async function claim() {
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('claim_ticket', { p_ticket: ticket.id })
      if (error) throw error
      showToast(data === user.id ? 'Assigned to you.' : 'A teammate already claimed this ticket.')
      await refresh()
    } catch (error) {
      showToast(error.message || 'Could not claim this ticket.', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="assignment">
      <span>
        Assigned to <strong>{ticket.assignee?.full_name || 'Unassigned'}</strong>
      </span>
      {isStaff && available && (
        <button className="primary-action" onClick={claim} disabled={busy}>
          <HandPalm size={15} />
          {busy ? 'Claiming…' : 'Claim ticket'}
        </button>
      )}
    </div>
  )
}
