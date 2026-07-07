import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CircleNotch } from '@phosphor-icons/react'

export default function ProtectedRoute({ children, adminOnly = false, staffOnly = false }) {
  const { user, isAdmin, isStaff, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-stone-50 dark:bg-stone-950">
        <CircleNotch size={24} weight="bold" className="animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  if (staffOnly && !isStaff) return <Navigate to="/" replace />

  return children
}
