import { LoginForm } from '@/components/login-form'
import Link from 'next/link'

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; next?: string }>
}) {
  const params = searchParams ? await searchParams : undefined

  return (
    <div className="auth-page">
      <header className="site-header">
        <Link className="wordmark" href="/">Reed</Link>
      </header>

      <main className="auth-main">
        <section className="auth-panel">
          <div className="auth-copy">
            <h1>Pick up where you left off.</h1>
            <p>Reed keeps your goals, patterns, and open commitments in view so each conversation can get straight to the useful part.</p>
          </div>

          <div className="auth-card">
            <div className="auth-card-header">
              <h2>Welcome to Reed</h2>
              <p>Sign in, create an account, or continue with Google.</p>
            </div>
            <LoginForm initialError={params?.error ?? null} nextPath={params?.next ?? '/chat'} />
          </div>
        </section>
      </main>
    </div>
  )
}
