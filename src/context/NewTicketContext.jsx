import { createContext, useCallback, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useToast } from './ToastContext'
import { useRefresh } from './RefreshContext'
import NewTicketModal from '../components/tickets/NewTicketModal'

// The sidebar's "+ New Ticket" button has to work from every page, so the
// modal and its submit logic live here, above the routes, instead of inside
// any one page. On success we jump straight to the new ticket's detail page
// (the fewest-clicks path to "did it go through?") and fire a background
// refresh so any list the user navigates back to is already up to date.
const NewTicketContext = createContext(null)

export function NewTicketProvider({ children }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { refresh } = useRefresh()

  const openNewTicket = useCallback(() => setOpen(true), [])
  const closeNewTicket = useCallback(() => setOpen(false), [])

  async function handleCreate({ title, description, category, priority, honeypot }) {
    const { data, error } = await supabase.rpc('create_ticket', {
      p_title: title,
      p_description: description,
      p_category: category,
      p_priority: priority ?? 'medium',
      p_honeypot: honeypot ?? '',
    })
    if (error) throw error
    showToast('Ticket created.', 'success')
    refresh()
    navigate(`/tickets/${data.id}`)
  }

  return (
    <NewTicketContext.Provider value={{ openNewTicket }}>
      {children}
      <NewTicketModal open={open} onClose={closeNewTicket} onCreate={handleCreate} />
    </NewTicketContext.Provider>
  )
}

export function useNewTicket() {
  const ctx = useContext(NewTicketContext)
  if (!ctx) throw new Error('useNewTicket must be used within a NewTicketProvider')
  return ctx
}
