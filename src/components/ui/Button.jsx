import { forwardRef } from 'react'
import { CircleNotch } from '@phosphor-icons/react'

const VARIANTS = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600 disabled:bg-indigo-300 dark:disabled:bg-indigo-900 dark:disabled:text-indigo-400',
  secondary:
    'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50 focus-visible:outline-indigo-600 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-600 dark:hover:bg-stone-700',
  danger:
    'bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-600 disabled:bg-rose-300',
  ghost:
    'text-stone-600 hover:bg-stone-100 focus-visible:outline-indigo-600 dark:text-stone-300 dark:hover:bg-stone-800',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading && <CircleNotch size={16} weight="bold" className="animate-spin" />}
      {children}
    </button>
  )
})

export default Button
