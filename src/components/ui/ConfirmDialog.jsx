import { useState } from 'react'
import { createPortal } from 'react-dom'
import { WarningCircle } from '@phosphor-icons/react'
import Button from './Button'

export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'primary',
}) {
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  async function handleConfirm() {
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-overlay-in bg-stone-900/50 backdrop-blur-sm dark:bg-stone-950/70"
        onClick={submitting ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-sm animate-modal-in rounded-xl bg-white p-6 shadow-xl shadow-stone-900/10 dark:bg-stone-800"
      >
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
            <WarningCircle size={18} weight="fill" className="text-amber-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{description}</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" variant={variant} size="sm" loading={submitting} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
