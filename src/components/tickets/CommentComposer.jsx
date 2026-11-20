import { useState } from 'react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import Button from '../ui/Button'
import Honeypot from '../ui/Honeypot'

const limit = 1000

export default function CommentComposer({ onSubmit }) {
  const [body, setBody] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function send(event) {
    event.preventDefault()
    const trimmed = body.trim()
    if (submitting || honeypot || !trimmed) return
    setError('')
    if (trimmed.length > limit) {
      setError('Keep replies under 1,001 characters.')
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(trimmed)
      setBody('')
    } catch (err) {
      setError(err.message || 'Could not send your reply. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={send} className="reply-composer">
      <Honeypot value={honeypot} onChange={(event) => setHoneypot(event.target.value)} name="website" />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={limit}
        readOnly={submitting}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.nativeEvent.isComposing &&
            (event.ctrlKey || event.metaKey)
          ) {
            event.preventDefault()
            event.currentTarget.form.requestSubmit()
          }
        }}
        rows={3}
        placeholder="Write a reply…"
        aria-label="Write a reply"
      />
      {error && (
        <p role="alert" className="request-error">
          {error}
        </p>
      )}
      <div className="reply-actions">
        <span>
          {body.length > 800 ? `${body.length} / ${limit}` : 'Visible to the requester and IT support'}
        </span>
        <Button
          type="submit"
          size="sm"
          title="Send reply (Ctrl or ⌘ + Enter)"
          loading={submitting}
          disabled={!body.trim()}
        >
          Reply <PaperPlaneTilt size={15} weight="bold" />
        </Button>
      </div>
    </form>
  )
}
