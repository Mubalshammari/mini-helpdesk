import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Textarea } from '../ui/Field'

const TITLE_MIN = 5
const TITLE_MAX = 120
const DESCRIPTION_MIN = 10
const DESCRIPTION_MAX = 2000

export default function EditTicketModal({ open, onClose, ticket, onSave }) {
  const [title, setTitle] = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  function handleClose() {
    if (submitting) return
    setTitle(ticket.title)
    setDescription(ticket.description)
    setErrors({})
    setFormError('')
    onClose()
  }

  function validate() {
    const next = {}
    const t = title.trim()
    const d = description.trim()
    if (t.length < TITLE_MIN || t.length > TITLE_MAX) {
      next.title = `Title must be ${TITLE_MIN}-${TITLE_MAX} characters.`
    }
    if (d.length < DESCRIPTION_MIN || d.length > DESCRIPTION_MAX) {
      next.description = `Description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters.`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setSubmitting(true)
    try {
      // Only title/description are ever sent - enforce_ticket_update_rules()
      // (supabase/migrations.sql section 6.1) rejects any other column from
      // a non-admin owner, and rejects this too once the ticket leaves
      // 'open'. This modal only renders while that's true (see
      // TicketDetailPage), but the payload shape matches the DB contract
      // regardless of what the UI happens to allow at render time.
      await onSave({ title: title.trim(), description: description.trim() })
      onClose()
    } catch (err) {
      setFormError(err.message ?? 'Could not save your changes. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Edit ticket">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          maxLength={TITLE_MAX}
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          maxLength={DESCRIPTION_MAX}
          rows={5}
          required
        />
        {formError && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
            {formError}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}
