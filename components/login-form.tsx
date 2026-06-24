'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function LoginForm({
  initialError,
  nextPath,
}: {
  initialError: string | null
  nextPath: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('maya@demo.reed')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)

  async function handleGoogleSignIn() {
    setIsGoogleSubmitting(true)
    setError(null)

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })

    if (signInError) {
      setIsGoogleSubmitting(false)
      setError(signInError.message)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setNotice(null)

    const supabase = createClient()
    const authResult =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
            },
          })

    setIsSubmitting(false)

    if (authResult.error) {
      setError(authResult.error.message)
      return
    }

    if (mode === 'sign-up' && !authResult.data.session) {
      setNotice('Check your email to confirm your account, then come back to sign in.')
      return
    }

    startTransition(() => {
      router.push(nextPath)
      router.refresh()
    })
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-mode-toggle" aria-label="Choose authentication mode">
        <button
          className={mode === 'sign-in' ? 'active' : undefined}
          onClick={() => {
            setMode('sign-in')
            setEmail((currentEmail) => currentEmail || 'maya@demo.reed')
            setError(null)
            setNotice(null)
          }}
          type="button"
        >
          Sign in
        </button>
        <button
          className={mode === 'sign-up' ? 'active' : undefined}
          onClick={() => {
            setMode('sign-up')
            setEmail('')
            setError(null)
            setNotice(null)
          }}
          type="button"
        >
          Sign up
        </button>
      </div>

      <button
        className="oauth-button"
        disabled={isGoogleSubmitting || isSubmitting}
        onClick={handleGoogleSignIn}
        type="button"
      >
        <span aria-hidden="true">G</span>
        {isGoogleSubmitting ? 'Opening Google...' : 'Continue with Google'}
      </button>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <div className="field-group">
        <label htmlFor="email">Email</label>
        <input
          required
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field-group">
        <label htmlFor="password">Password</label>
        <input
          required
          id="password"
          type="password"
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
        />
      </div>

      {(error ?? initialError) ? (
        <div className="auth-error">
          {error ?? initialError}
        </div>
      ) : null}

      {notice ? (
        <div className="auth-notice">
          {notice}
        </div>
      ) : null}

      <button
        className="primary-button"
        type="submit"
        disabled={isSubmitting || isGoogleSubmitting}
      >
        {isSubmitting ? (mode === 'sign-in' ? 'Signing in...' : 'Creating account...') : mode === 'sign-in' ? 'Continue' : 'Create account'}
      </button>

      <p className="auth-demo">
        Want to try it first? Use maya@demo.reed · reed-demo-2024
      </p>
    </form>
  )
}
