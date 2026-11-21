import { forwardRef, useId } from 'react'

const fieldClasses = (hasError) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500 ${
    hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/30 dark:border-rose-500'
      : 'border-stone-300 focus:border-indigo-500 focus:ring-indigo-500/30 dark:border-stone-600'
  }`

function FieldShell({ id, label, error, helperText, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-stone-700 dark:text-stone-200">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={id + '-hint'} className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : helperText ? (
        <p id={id + '-hint'} className="text-sm text-stone-500 dark:text-stone-400">{helperText}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef(function Input(
  { label, error, helperText, required, id, className = '', ...props },
  ref
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell id={fieldId} label={label} error={error} helperText={helperText} required={required}>
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? fieldId + '-hint' : undefined}
        className={`${fieldClasses(Boolean(error))} ${className}`}
        {...props}
      />
    </FieldShell>
  )
})

export const Textarea = forwardRef(function Textarea(
  { label, error, helperText, required, id, className = '', ...props },
  ref
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell id={fieldId} label={label} error={error} helperText={helperText} required={required}>
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? fieldId + '-hint' : undefined}
        className={`${fieldClasses(Boolean(error))} resize-none ${className}`}
        {...props}
      />
    </FieldShell>
  )
})

export const Select = forwardRef(function Select(
  { label, error, helperText, required, id, className = '', children, ...props },
  ref
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell id={fieldId} label={label} error={error} helperText={helperText} required={required}>
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error || helperText ? fieldId + '-hint' : undefined}
        className={`${fieldClasses(Boolean(error))} ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  )
})
