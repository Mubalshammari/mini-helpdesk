import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Headset, ShieldCheck, ClockCounterClockwise, ArrowRight } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Honeypot from '../components/ui/Honeypot'

const FEATURES = [
  { icon: Headset, text: 'Submit and track IT support requests in one place' },
  { icon: ClockCounterClockwise, text: 'Follow every status change from open to resolved' },
  { icon: ShieldCheck, text: 'Your tickets are visible only to you and IT staff' },
]

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
        const { needsEmailConfirmation } = await signUp(fields.email, fields.password, fields.fullName.trim())
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
    <div className="grid min-h-[100dvh] grid-cols-1 bg-stone-50 dark:bg-stone-950 lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-indigo-950 p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500">
            <Headset size={18} weight="fill" className="text-white" />
          </div>
          <span className="text-lg font-semibold text-white">Mini Helpdesk</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            IT support, without the runaround.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-indigo-200">
            Log an issue, watch it move, get an answer. One queue for every request across the
            company.
          </p>
          <ul className="mt-10 flex flex-col gap-4">
            {FEATURES.map((feature) => {
              const FeatureIcon = feature.icon
              return (
                <li key={feature.text} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <FeatureIcon size={13} weight="bold" className="text-indigo-200" />
                  </div>
                  <span className="text-sm text-indigo-100">{feature.text}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <p className="relative text-xs text-indigo-300">Internal tool. Sign in with your company email.</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Headset size={18} weight="fill" className="text-white" />
            </div>
            <span className="text-lg font-semibold text-stone-900 dark:text-stone-100">Mini Helpdesk</span>
          </div>

          {checkEmail ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-stone-200 p-8 text-center dark:border-stone-700">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/10">
                <Headset size={22} weight="regular" className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">Check your email</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                We sent a confirmation link to <span className="font-medium">{fields.email}</span>. Follow it to
                activate your account, then sign in.
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
      </div>
    </div>
  )
}
