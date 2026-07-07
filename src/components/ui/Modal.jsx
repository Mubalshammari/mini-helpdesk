import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  const dialogRef = useRef(null)
  // Keep the latest onClose in a ref rather than the effect's dependency
  // array. Callers typically pass an inline handler (a new function
  // identity on every render of the parent, e.g. every keystroke in a form
  // field inside this modal) - if onClose were a dependency, the effect
  // below would re-run on every one of those renders and call
  // dialogRef.current.focus() again, yanking focus out of whatever input
  // the user was actively typing in after a single character. Depending
  // only on `open` means the focus-and-listener setup runs exactly once per
  // actual open, while the Escape handler still always calls the current
  // onClose via the ref.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-overlay-in bg-stone-900/50 backdrop-blur-sm dark:bg-stone-950/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative z-10 w-full ${maxWidth} animate-modal-in rounded-xl bg-white shadow-xl shadow-stone-900/10 focus:outline-none dark:bg-stone-800`}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 dark:border-stone-700">
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-700 dark:hover:text-stone-300"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
