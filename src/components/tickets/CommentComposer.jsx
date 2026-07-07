import { useState } from 'react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import Button from '../ui/Button'
import Honeypot from '../ui/Honeypot'

const BODY_MIN = 1
const BODY_MAX = 1000

export default function CommentComposer({ onSubmit }) {
  const [body, setBody] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (honeypot) return // silently drop - bot filled the hidden field

    const trimmed = body.trim()
    if (trimmed.length < BODY_MIN || trimmed.length > BODY_MAX) {
      setError(`Reply must be ${BODY_MIN}-${BODY_MAX} characters.`)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(trimmed)
      setBody('')
    } catch (err) {
      setError(err.message ?? 'Could not post your reply. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <Honeypot value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="website" />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={BODY_MAX}
        rows={3}
        placeholder="Write a reply"
        aria-label="Write a reply"
        className="w-full resize-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
      />
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={submitting} disabled={!body.trim()}>
          Reply
          {!submitting && <PaperPlaneTilt size={14} weight="bold" />}
        </Button>
      </div>
    </form>
  )
}
