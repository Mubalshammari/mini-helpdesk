import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Textarea, Select } from '../ui/Field'
import Honeypot from '../ui/Honeypot'
import { CATEGORIES, PRIORITIES } from '../../lib/constants'
import { PRIORITY_META } from '../ui/PriorityIcon'

const TITLE_MIN = 5
const TITLE_MAX = 120
const DESCRIPTION_MIN = 10
const DESCRIPTION_MAX = 2000

const initialFields = { title: '', description: '', category: CATEGORIES[0].value, priority: 'medium' }

export default function NewTicketModal({ open, onClose, onCreate }) {
  const [fields, setFields] = useState(initialFields)
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  function reset() {
    setFields(initialFields)
    setHoneypot('')
    setErrors({})
    setFormError('')
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  function validate() {
    const next = {}
    const title = fields.title.trim()
    const description = fields.description.trim()

    if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      next.title = `Title must be ${TITLE_MIN}-${TITLE_MAX} characters.`
    }
    if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX) {
      next.description = `Description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters.`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (honeypot) return // silently drop - bot filled the hidden field

    if (!validate()) return

    setSubmitting(true)
    try {
      await onCreate({
        title: fields.title.trim(),
        description: fields.description.trim(),
        category: fields.category,
        priority: fields.priority,
        honeypot,
      })
      reset()
      onClose()
    } catch (err) {
      // create_ticket() raises plain, already-generic messages (rate limit,
      // duplicate guard, auth) - safe to show directly, no leaking of
      // internals like row counts or SQL state.
      setFormError(err.message ?? 'Could not create the ticket. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="New ticket">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Honeypot value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />

        <Input
          label="Title"
          value={fields.title}
          onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
          error={errors.title}
          maxLength={TITLE_MAX}
          placeholder="VPN disconnects every few minutes"
          required
        />

        <Textarea
          label="Description"
          value={fields.description}
          onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
          error={errors.description}
          maxLength={DESCRIPTION_MAX}
          rows={5}
          placeholder="What's happening, when it started, and what you've already tried."
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Category"
            value={fields.category}
            onChange={(e) => setFields((f) => ({ ...f, category: e.target.value }))}
            required
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>

          <Select
            label="Priority"
            value={fields.priority}
            onChange={(e) => setFields((f) => ({ ...f, priority: e.target.value }))}
            helperText="How urgent this is for you. IT can adjust it later."
            required
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </Select>
        </div>

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
            Create ticket
          </Button>
        </div>
      </form>
    </Modal>
  )
}
