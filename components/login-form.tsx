'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function getAuthCallbackUrl(nextPath: string) {
  const callbackUrl = new URL('/auth/callback', window.location.origin)
  callbackUrl.searchParams.set('next', nextPath)
  return callbackUrl.toString()
}

export function LoginForm({
  initialError,
  nextPath,
}: {
  initialError: string | null
  nextPath: string
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)

  async function handleGoogleSignIn() {
    setIsGoogleSubmitting(true)
    setError(null)

    const supabase = createClient()
    const redirectTo = getAuthCallbackUrl(nextPath)
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
              emailRedirectTo: getAuthCallbackUrl(nextPath),
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

      <div className="auth-switch-prompt">
        {mode === 'sign-in' ? (
          <>
            <span>New to Reed?</span>
            <button
              onClick={() => {
                setMode('sign-up')
                setEmail('')
                setPassword('')
                setError(null)
                setNotice(null)
              }}
              type="button"
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            <span>Already have an account?</span>
            <button
              onClick={() => {
                setMode('sign-in')
                setEmail('')
                setPassword('')
                setError(null)
                setNotice(null)
              }}
              type="button"
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </form>
  )
}
