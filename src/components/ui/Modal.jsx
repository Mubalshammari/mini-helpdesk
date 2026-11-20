import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', alert = false }) {
  const ref = useRef(null)
  const headingId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <dialog
      ref={ref}
      className={'desk-dialog ' + maxWidth}
      aria-labelledby={headingId}
      role={alert ? 'alertdialog' : 'dialog'}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog-body">
        <header>
          <h2 id={headingId}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>
        <div className="dialog-content">{children}</div>
      </div>
    </dialog>,
    document.body
  )
}
