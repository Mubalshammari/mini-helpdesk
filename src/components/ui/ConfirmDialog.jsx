import { useState } from 'react'
import Modal from './Modal'
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
  async function confirm() {
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <Modal
      open={open}
      alert
      title={title}
      maxWidth="max-w-sm"
      onClose={() => {
        if (!submitting) onCancel()
      }}
    >
      <p className="text-sm">{description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button variant={variant} size="sm" onClick={confirm} loading={submitting}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
