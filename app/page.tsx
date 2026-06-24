import Link from 'next/link'

function ProductPreview() {
  return (
    <div className="product-preview" aria-hidden="true">
      <div className="preview-sidebar">
        <div className="preview-wordmark">Reed</div>
        <div className="preview-section">
          <span>Goal</span>
          <p>Move into product strategy without underselling ops depth.</p>
        </div>
        <div className="preview-section">
          <span>Pattern</span>
          <p>Waits until credentials feel perfect before reaching out.</p>
        </div>
        <div className="preview-section preview-hot">
          <span>Open</span>
          <p>Apply to 2 product-adjacent roles this week.</p>
        </div>
      </div>
      <div className="preview-chat">
        <div className="preview-topbar">
          <span />
          <span />
        </div>
        <div className="preview-note">
          <p>You said you would apply to 2 product-adjacent roles. That was 12 days ago, and the same hesitation showed up again today.</p>
        </div>
        <div className="preview-message preview-reed">
          <p>Let us separate the career signal from the confidence noise. What part of the posting makes you think you are underqualified?</p>
        </div>
        <div className="preview-message preview-user">
          <p>The title says Senior PM, and I keep thinking my resume reads too operations-heavy.</p>
        </div>
        <div className="preview-composer">
          <span>Ask Reed...</span>
          <b />
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="landing-page">
      <header className="site-header">
        <Link className="wordmark" href="/">Reed</Link>
        <nav>
          <Link className="nav-cta" href="/login">Sign in</Link>
        </nav>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">Context that compounds</p>
            <h1>Reed remembers the work between conversations.</h1>
            <p>
              A focused AI mentor for career decisions, applications, and follow-through. Reed carries your goals, notices recurring patterns, and brings back the commitments you meant to keep.
            </p>
            <div className="hero-actions">
              <Link className="primary-link" href="/login">Start a conversation</Link>
            </div>
          </div>
          <ProductPreview />
        </section>

        <section className="proof-strip" aria-label="Reed capabilities">
          <div>
            <strong>Persistent ledger</strong>
            <span>Goals, signals, commitments, and previous sessions stay attached to the conversation.</span>
          </div>
          <div>
            <strong>Document-aware</strong>
            <span>Attach a resume or notes and Reed can connect the content to your current direction.</span>
          </div>
          <div>
            <strong>Fast follow-up</strong>
            <span>Each session starts with the most relevant unfinished loop, not generic small talk.</span>
          </div>
        </section>

        <section className="workflow-section">
          <div className="workflow-copy">
            <p className="eyebrow">How it feels</p>
            <h2>Less intake. More useful tension.</h2>
            <p>
              Reed is built for the messy middle of career change: the half-written resume, the role you keep avoiding, the signal you keep dismissing, and the promise you made to yourself last week.
            </p>
          </div>
          <div className="workflow-steps">
            <div>
              <span>1</span>
              <h3>Bring the decision</h3>
              <p>Talk through a role, application, offer, resume, or next move.</p>
            </div>
            <div>
              <span>2</span>
              <h3>Reed carries the pattern</h3>
              <p>Important goals and recurring signals are saved into a lightweight memory ledger.</p>
            </div>
            <div>
              <span>3</span>
              <h3>Return with context</h3>
              <p>The next session begins from what changed, what stalled, and what still matters.</p>
            </div>
          </div>
        </section>

        <section className="value-band" aria-label="What Reed helps with">
          <div>
            <span>01</span>
            <h2>Follow-through</h2>
            <p>Turns loose intentions into visible commitments without making the conversation feel like project management.</p>
          </div>
          <div>
            <span>02</span>
            <h2>Pattern memory</h2>
            <p>Surfaces the self-doubt, avoidance loops, and underplayed strengths that keep shaping career choices.</p>
          </div>
          <div>
            <span>03</span>
            <h2>Contextful advice</h2>
            <p>Reads attached resumes or notes, then connects them to the goals and signals Reed already carries.</p>
          </div>
        </section>

        <section className="final-cta">
          <p className="eyebrow">Start with the next real thing</p>
          <h2>Open a conversation Reed can remember.</h2>
          <Link className="primary-link" href="/login">Try Reed</Link>
        </section>
      </main>
    </div>
  )
}
