import { useRef, useState } from 'react'
import {
  AppWindow,
  ArrowUpRight,
  CheckCircle,
  DesktopTower,
  DotsThree,
  GlobeHemisphereWest,
  IdentificationCard,
  Key,
} from '@phosphor-icons/react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Input, Textarea, Select } from '../ui/Field'
import Honeypot from '../ui/Honeypot'
import { CATEGORIES, PRIORITIES } from '../../lib/constants'
import { PRIORITY_META } from '../ui/PriorityIcon'
import '../../ticket-experience.css'

const requestTypes = {
  hardware: {
    icon: DesktopTower,
    title: 'Meeting room display loses signal',
    details: 'Which device is affected, where is it, and what happens when you use it?',
  },
  software: {
    icon: AppWindow,
    title: 'Spreadsheet app closes when saving',
    details: 'Which app are you using, and what steps lead to the problem?',
  },
  network: {
    icon: GlobeHemisphereWest,
    title: 'Office Wi-Fi drops during calls',
    details: 'Where are you connecting from, and does the issue affect anyone else?',
  },
  account: {
    icon: IdentificationCard,
    title: 'Unable to sign in to my email',
    details: 'Which account is affected, and what message do you see when signing in?',
  },
  access: {
    icon: Key,
    title: 'Read access needed for the shared drive',
    details: 'Which resource do you need, and what work is waiting on access?',
  },
  other: {
    icon: DotsThree,
    title: 'Describe the request in a few words',
    details: 'What do you need help with, and what would a successful outcome look like?',
  },
}

const impact = {
  low: 'This can wait. Work can continue as usual.',
  medium: 'Work is slower, but there is a workaround.',
  high: 'Someone is blocked from completing important work.',
  urgent: 'An essential service is down or several people are blocked.',
}
const initialFields = { title: '', description: '', category: 'hardware', priority: 'medium' }

export default function NewTicketModal({ open, onClose, onCreate }) {
  const [fields, setFields] = useState(initialFields)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const titleInput = useRef(null)
  const descriptionInput = useRef(null)
  const selected = requestTypes[fields.category]

  function change(name, value) {
    setFields((previous) => ({ ...previous, [name]: value }))
    if (errors[name]) setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  function close() {
    setFields(initialFields)
    setErrors({})
    setFormError('')
    setHoneypot('')
    onClose()
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting || honeypot) return
    setFormError('')
    const title = fields.title.trim()
    const description = fields.description.trim()
    const nextErrors = {}
    if (title.length < 5 || title.length > 120)
      nextErrors.title = 'Use 5 to 120 characters for the title.'
    if (description.length < 10 || description.length > 2000)
      nextErrors.description = 'Use 10 to 2,000 characters to describe the request.'
    setErrors(nextErrors)
    if (nextErrors.title || nextErrors.description) {
      const input = nextErrors.title ? titleInput : descriptionInput
      input.current?.focus()
      return
    }
    setSubmitting(true)
    try {
      await onCreate({ ...fields, title, description, honeypot })
      close()
    } catch (error) {
      setFormError(error.message || 'Could not submit the request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) close()
      }}
      title="New ticket"
      maxWidth="max-w-xl"
    >
      <form className="request-form" onSubmit={submit} noValidate>
        <Honeypot value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        <fieldset className="request-type-group">
          <legend>Category</legend>
          <div className="request-types">
            {CATEGORIES.map(({ value, label }) => {
              const Icon = requestTypes[value].icon
              return (
                <label key={value} className="request-type">
                  <input
                    type="radio"
                    name="category"
                    value={value}
                    checked={fields.category === value}
                    onChange={() => change('category', value)}
                  />
                  <span>
                    <Icon size={19} weight="duotone" />
                    {label}
                    <CheckCircle className="request-type-check" size={14} weight="fill" />
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <Input
          ref={titleInput}
          label="Title"
          value={fields.title}
          onChange={(e) => change('title', e.target.value)}
          placeholder={selected.title}
          error={errors.title}
          maxLength={120}
          required
        />
        <Textarea
          ref={descriptionInput}
          label="Description"
          value={fields.description}
          onChange={(e) => change('description', e.target.value)}
          placeholder={selected.details}
          error={errors.description}
          rows={3}
          maxLength={2000}
          required
        />
        <div className="request-impact">
          <Select
            label="Priority"
            value={fields.priority}
            onChange={(e) => change('priority', e.target.value)}
            aria-describedby="request-impact-description"
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_META[value].label}
              </option>
            ))}
          </Select>
          <p id="request-impact-description" aria-live="polite">
            {impact[fields.priority]}
          </p>
        </div>

        {formError && (
          <p className="request-error" role="alert">
            {formError}
          </p>
        )}
        <div className="request-footer">
          <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create ticket <ArrowUpRight size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  )
}
