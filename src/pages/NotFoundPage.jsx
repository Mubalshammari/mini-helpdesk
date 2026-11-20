import { Link } from 'react-router-dom'
import { CompassRose } from '@phosphor-icons/react'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <div className="missing-page flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-stone-50 px-6 text-center dark:bg-stone-950">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10">
        <CompassRose size={26} weight="regular" className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <div>
        <h1 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Page not found</h1>
        <p className="mt-1.5 max-w-sm text-sm text-stone-500 dark:text-stone-400">
          The page you're looking for doesn't exist or may have moved.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 active:scale-[0.98]"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
