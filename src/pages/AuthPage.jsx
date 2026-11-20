import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Ticket, ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Honeypot from '../components/ui/Honeypot'

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function AuthPage() {
  usePageTitle('Sign in')
  const { user, loading, signIn, signUp } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin')
  const [submitting, setSubmitting] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
  const [fields, setFields] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState({})

  if (!loading && user) return <Navigate to="/" replace />

  const update = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }))

  function validate() {
    const next = {}
    if (mode === 'signup' && fields.fullName.trim().length < 2) {
      next.fullName = 'Enter your full name.'
    }
    if (!validateEmail(fields.email)) {
      next.email = 'Enter a valid email address.'
    }
    if (fields.password.length < 8) {
      next.password = 'Password must be at least 8 characters.'
    }
    if (mode === 'signup' && fields.confirmPassword !== fields.password) {
      next.confirmPassword = 'Passwords do not match.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (honeypot) return // silently drop - bot filled the hidden field

    if (!validate()) return

    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(fields.email, fields.password)
        navigate('/', { replace: true })
      } else {
        const { needsEmailConfirmation } = await signUp(
          fields.email,
          fields.password,
          fields.fullName.trim()
        )
        if (needsEmailConfirmation) {
          setCheckEmail(true)
        } else {
          navigate('/', { replace: true })
        }
      }
    } catch (err) {
      // Supabase's own auth error messages are already generic enough not to
      // leak internal details (e.g. "Invalid login credentials" rather than
      // "no user with that email"), so they're safe to surface directly.
      showToast(err.message ?? 'Something went wrong. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode(next) {
    setMode(next)
    setErrors({})
    setCheckEmail(false)
  }

  return (
    <main className="auth-layout">
      <section className="auth-poster">
        <div className="auth-wordmark">
          <Ticket weight="duotone" size={30} />
          Mini Helpdesk
        </div>
        <div className="paper-art" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="auth-caption">
          <h1>Support desk</h1>
          <p>Request IT support and follow your ticket from the first reply to resolution.</p>
        </div>
      </section>
      <section className="auth-form">
        <div className="w-full max-w-sm">
          {checkEmail ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-stone-200 p-8 text-center dark:border-stone-700">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10">
                <Ticket size={22} weight="regular" className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Check your email
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                We sent a confirmation link to <span className="font-medium">{fields.email}</span>.
                Follow it to activate your account, then sign in.
              </p>
              <Button variant="secondary" onClick={() => switchMode('signin')} className="mt-2">
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
                {mode === 'signin' ? 'Sign in' : 'Create your account'}
              </h2>
              <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
                {mode === 'signin' ? (
                  <>
                    New here?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>

              <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
                <Honeypot value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />

                {mode === 'signup' && (
                  <Input
                    label="Full name"
                    type="text"
                    autoComplete="name"
                    value={fields.fullName}
                    onChange={update('fullName')}
                    error={errors.fullName}
                    required
                  />
                )}

                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={fields.email}
                  onChange={update('email')}
                  error={errors.email}
                  required
                />

                <Input
                  label="Password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={fields.password}
                  onChange={update('password')}
                  error={errors.password}
                  helperText={mode === 'signup' ? 'At least 8 characters.' : undefined}
                  required
                />

                {mode === 'signup' && (
                  <Input
                    label="Confirm password"
                    type="password"
                    autoComplete="new-password"
                    value={fields.confirmPassword}
                    onChange={update('confirmPassword')}
                    error={errors.confirmPassword}
                    required
                  />
                )}

                <Button type="submit" loading={submitting} className="mt-2" size="lg">
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  {!submitting && <ArrowRight size={16} weight="bold" />}
                </Button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
