import { useCallback, useId, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, LockSimple } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useWorkspaceQuery } from '../../hooks/useWorkspaceQuery'
import { formatDateTime } from '../../lib/format'
import { supabase } from '../../lib/supabaseClient'
import Button from '../ui/Button'
import './staff-notes.css'

const PAGE_SIZE = 12
const MAX_LENGTH = 2000

export default function StaffNotes({ ticketId }) {
  const { isStaff } = useAuth()
  return isStaff ? <NoteThread key={ticketId} ticketId={ticketId} /> : null
}

function NoteThread({ ticketId }) {
  const [pages, setPages] = useState([])
  const before = pages.at(-1)
  const read = useCallback(() => {
    let query = supabase
      .from('ticket_staff_notes')
      .select('id, body, created_at, author:profiles!author_id(full_name)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1)
    if (before) {
      const time = JSON.stringify(before.created_at)
      query = query.or(`created_at.lt.${time},and(created_at.eq.${time},id.lt.${before.id})`)
    }
    return query
  }, [before, ticketId])
  const { data, error, refresh } = useWorkspaceQuery('staff-notes', read)
  const notes = data?.slice(0, PAGE_SIZE)

  async function saved() {
    if (pages.length) setPages([])
    else await refresh()
  }

  return (
    <section className="staff-notes" aria-label="Staff note thread">
      <p className="staff-notes-visibility">
        <LockSimple size={16} weight="bold" />
        Only visible to IT staff and admins
      </p>
      <NoteForm ticketId={ticketId} onSaved={saved} />
      {error ? (
        <p role="alert">
          Couldn’t load internal notes.{' '}
          <button type="button" className="staff-notes-link" onClick={refresh}>
            Try again
          </button>
        </p>
      ) : !notes ? (
        <p role="status">Loading internal notes…</p>
      ) : !notes.length ? (
        <p className="staff-notes-empty">No internal notes yet.</p>
      ) : (
        <ol>
          {notes.map((note) => (
            <li key={note.id}>
              <header>
                <strong>{note.author?.full_name || 'Former teammate'}</strong>
                <time dateTime={note.created_at}>{formatDateTime(note.created_at)}</time>
              </header>
              <p>{note.body}</p>
            </li>
          ))}
        </ol>
      )}
      {notes && (pages.length > 0 || data.length > PAGE_SIZE) && (
        <nav aria-label="Internal note pages">
          <button
            type="button"
            disabled={!pages.length}
            onClick={() => setPages((current) => current.slice(0, -1))}
          >
            <ArrowLeft /> Newer notes
          </button>
          <button
            type="button"
            disabled={data.length <= PAGE_SIZE}
            onClick={() => setPages((current) => [...current, notes.at(-1)])}
          >
            Older notes <ArrowRight />
          </button>
        </nav>
      )}
    </section>
  )
}

function NoteForm({ ticketId, onSaved }) {
  const fieldId = useId()
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(null)

  async function submit(event) {
    event.preventDefault()
    const text = body.trim()
    if (!text || saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      // Keep the same ID if the server saved a note but the response was lost.
      if (pending.current?.text !== text) pending.current = { id: crypto.randomUUID(), text }
      const result = await supabase.rpc('add_staff_note', {
        p_ticket: ticketId,
        p_note: pending.current.id,
        p_body: text,
      })
      if (result.error) throw result.error
      pending.current = null
      setBody('')
      setNotice('Internal note added.')
      await onSaved()
    } catch (problem) {
      setError(problem.message || 'Couldn’t save this note. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={fieldId}>Add an internal note</label>
      <textarea
        id={fieldId}
        value={body}
        readOnly={saving}
        rows={3}
        maxLength={MAX_LENGTH}
        placeholder="Leave a handoff or troubleshooting detail for a teammate."
        onChange={(event) => {
          setBody(event.target.value)
          setNotice('')
          setError('')
        }}
      />
      <div className="staff-notes-actions">
        <span role="status">{notice}</span>
        <Button type="submit" size="sm" loading={saving} disabled={!body.trim()}>
          Add note
        </Button>
      </div>
      {error && (
        <p className="staff-notes-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
