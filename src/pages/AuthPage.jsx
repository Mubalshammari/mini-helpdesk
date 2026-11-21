import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, EnvelopeSimple, Eye, EyeSlash, Ticket } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'
import { Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Honeypot from '../components/ui/Honeypot'
import ThemeToggle from '../components/ui/ThemeToggle'
import './auth.css'

function validate(fields, registering) {
  const errors = {}
  if (registering && fields.fullName.trim().length < 2) errors.fullName = 'Enter your full name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    errors.email = 'Enter a valid email address.'
  if (!fields.password) errors.password = 'Enter your password.'
  else if (registering && fields.password.length < 8) errors.password = 'Use at least 8 characters.'
  if (registering && fields.password !== fields.confirmPassword)
    errors.confirmPassword = 'Passwords do not match.'
  return errors
}

function TicketIllustration() {
  return (
    <div className="access-art" aria-hidden="true">
      <div className="access-art-shadow" />
      <div className="access-slip access-slip-back" />
      <div className="access-slip access-slip-front">
        <div className="access-slip-body">
          <Ticket size={32} weight="bold" />
          <div className="access-slip-lines">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="access-slip-stub">
          <Check size={34} weight="bold" />
          <i />
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [submitting, setSubmitting] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [fields, setFields] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [requestError, setRequestError] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const headingRef = useRef(null)
  const focusHeading = useRef(false)
  const registering = mode === 'signup'
  const title = checkEmail ? 'Check your email' : registering ? 'Create your account' : 'Sign in'
  usePageTitle(title)

  useEffect(() => {
    if (focusHeading.current) {
      headingRef.current?.focus()
      focusHeading.current = false
    }
  }, [mode, checkEmail])

  if (!loading && user) return <Navigate to="/" replace />

  function update(field) {
    return (event) => {
      const value = event.target.value
      setFields((previous) => ({ ...previous, [field]: value }))
      setErrors((previous) => ({ ...previous, [field]: '' }))
      setRequestError('')
    }
  }

  function switchMode(next) {
    focusHeading.current = true
    setMode(next)
    setCheckEmail(false)
    setShowPassword(false)
    setRequestError('')
    setErrors({})
    setFields((previous) => ({ ...previous, password: '', confirmPassword: '' }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (honeypot || submitting) return
    const problems = validate(fields, registering)
    setErrors(problems)
    setRequestError('')
    const firstInvalid = Object.keys(problems)[0]
    if (firstInvalid) {
      event.currentTarget.elements.namedItem(firstInvalid)?.focus()
      return
    }

    setSubmitting(true)
    try {
      const email = fields.email.trim()
      if (registering) {
        const { needsEmailConfirmation } = await signUp(email, fields.password, fields.fullName.trim())
        if (needsEmailConfirmation) {
          focusHeading.current = true
          setCheckEmail(true)
          setShowPassword(false)
          setFields((previous) => ({ ...previous, email, password: '', confirmPassword: '' }))
          return
        }
      } else {
        await signIn(email, fields.password)
      }
      navigate('/', { replace: true })
    } catch (error) {
      setRequestError(error.message || 'Couldn’t reach the support desk. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="access-page">
      <div className="access-bar">
        <div className="access-brand">
          <Ticket weight="duotone" size={28} />
          Mini Helpdesk
        </div>
        <ThemeToggle />
      </div>
      <div className="access-layout">
        <section className="access-welcome" aria-label="Support desk">
          <TicketIllustration />
          <div className="access-intro">
            <h2>
              Company
              <br />
              support desk.
            </h2>
            <p>Send a request to IT, follow its progress and keep the conversation in one place.</p>
          </div>
        </section>
        <section className="access-form-panel" aria-labelledby="access-title">
          <div className="access-form-inner" key={title}>
            {checkEmail && <EnvelopeSimple size={38} weight="duotone" className="access-envelope" />}
            <h1 id="access-title" ref={headingRef} tabIndex={-1}>
              {title}
            </h1>
            {checkEmail ? (
              <div>
                <p className="access-description">
                  Open the confirmation link sent to <strong>{fields.email}</strong>, then sign in to
                  your workspace.
                </p>
                <Button
                  className="access-return"
                  variant="secondary"
                  onClick={() => switchMode('signin')}
                >
                  Back to sign in <ArrowRight size={16} />
                </Button>
              </div>
            ) : (
              <>
                <p className="access-description">
                  {registering
                    ? 'Use your work email to join the support desk.'
                    : 'Enter your work email and password to continue.'}
                </p>
                <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
                  <Honeypot value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                  <fieldset disabled={submitting} className="access-fields">
                    {registering && (
                      <Input
                        label="Full name"
                        name="fullName"
                        autoComplete="name"
                        value={fields.fullName}
                        onChange={update('fullName')}
                        error={errors.fullName}
                        required
                      />
                    )}
                    <Input
                      label="Email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={fields.email}
                      onChange={update('email')}
                      error={errors.email}
                      required
                    />
                    <Input
                      label="Password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={registering ? 'new-password' : 'current-password'}
                      value={fields.password}
                      onChange={update('password')}
                      error={errors.password}
                      helperText={registering ? 'At least 8 characters.' : undefined}
                      required
                    />
                    {registering && (
                      <Input
                        label="Confirm password"
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={fields.confirmPassword}
                        onChange={update('confirmPassword')}
                        error={errors.confirmPassword}
                        required
                      />
                    )}
                    <button
                      className="access-reveal"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                      {showPassword ? 'Hide' : 'Show'} {registering ? 'passwords' : 'password'}
                    </button>
                  </fieldset>
                  {requestError && (
                    <p className="access-error" role="alert">
                      {requestError}
                    </p>
                  )}
                  <Button className="access-submit" type="submit" loading={submitting} size="lg">
                    {registering ? 'Create account' : 'Sign in'}{' '}
                    {!submitting && <ArrowRight size={18} />}
                  </Button>
                </form>
                <p className="access-switch">
                  {registering ? 'Already have an account?' : 'New to the desk?'}{' '}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => switchMode(registering ? 'signin' : 'signup')}
                  >
                    {registering ? 'Sign in' : 'Create an account'}
                  </button>
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
