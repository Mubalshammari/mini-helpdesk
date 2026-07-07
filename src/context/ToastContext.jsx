import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle, WarningCircle, XCircle, X } from '@phosphor-icons/react'

const ToastContext = createContext(null)

const VARIANTS = {
  success: {
    icon: CheckCircle,
    iconClass: 'text-emerald-500 dark:text-emerald-400',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-rose-500 dark:text-rose-400',
  },
  info: {
    icon: WarningCircle,
    iconClass: 'text-indigo-500 dark:text-indigo-400',
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message, variant = 'info', duration = 5000) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev, { id, message, variant }])
      if (duration) {
        setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const { icon: Icon, iconClass } = VARIANTS[toast.variant] ?? VARIANTS.info
          return (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-lg shadow-stone-900/5 dark:border-stone-700 dark:bg-stone-800"
            >
              <Icon size={20} weight="fill" className={`mt-0.5 shrink-0 ${iconClass}`} />
              <p className="flex-1 text-sm text-stone-700 dark:text-stone-200">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-700 dark:hover:text-stone-300"
                aria-label="Dismiss notification"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
