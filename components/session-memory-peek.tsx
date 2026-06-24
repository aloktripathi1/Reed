'use client'

import { useState } from 'react'
import type { SessionContext } from '@/lib/coaching-logic/session-context'
import type { Message } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

type SessionRow = { id: string; started_at: string; opened_with_nudge: boolean }
type TranscriptMessage = Pick<Message, 'attachment_filename' | 'content' | 'created_at' | 'id' | 'role'>

/* ── Icon primitives ── */
function GoalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="var(--accent)" strokeWidth="1.1" />
      <circle cx="6.5" cy="6.5" r="2" fill="var(--accent)" />
    </svg>
  )
}

function PatternIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2.2 4.5 C3.2 1.8 9.8 1.8 10.8 4.5 C11.8 7.2 9.8 11 6.5 11.5 C3.2 11 1.2 7.2 2.2 4.5Z" stroke="var(--text-secondary)" strokeWidth="1.1" fill="none" />
    </svg>
  )
}

function CommitmentIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1.5" y="1.5" width="10" height="10" rx="1.5" stroke="var(--accent)" strokeWidth="1.1" />
      <path d="M4 6.5 L5.8 8.5 L9.5 4.5" stroke="var(--accent)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function TranscriptAttachmentChip({ filename }: { filename: string }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      maxWidth: '100%',
      padding: '5px 7px',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '7px',
      color: 'var(--text-primary)',
      marginBottom: '6px',
    }}>
      <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="12" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>
        {filename}
      </span>
    </div>
  )
}

/* ── Section header ── */
function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
      {icon}
      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.09em', textTransform: 'uppercase' as const }}>
        {label}
      </span>
    </div>
  )
}

/* ── Past conversations ── */
function PastConversations({ initialSessions }: { initialSessions: SessionRow[] }) {
  const [isOpen, setIsOpen] = useState(true)
  const [sessions, setSessions] = useState<SessionRow[] | null>(initialSessions)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [messagesBySession, setMessagesBySession] = useState<Record<string, TranscriptMessage[]>>({})
  const [loadingMessagesFor, setLoadingMessagesFor] = useState<string | null>(null)
  const [messageErrors, setMessageErrors] = useState<Record<string, string>>({})

  async function handleToggleOpen() {
    const opening = !isOpen
    setIsOpen(opening)
    if (opening && sessions === null) {
      setLoadingSessions(true)
      setSessionsError(null)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('sessions')
        .select('id, started_at, opened_with_nudge')
        .order('started_at', { ascending: false })
      setSessions(error ? [] : data ?? [])
      setSessionsError(error ? error.message : null)
      setLoadingSessions(false)
    }
  }

  async function handleToggleSession(sessionId: string) {
    if (expandedId === sessionId) { setExpandedId(null); return }
    setExpandedId(sessionId)
    if (messagesBySession[sessionId] !== undefined) return
    setLoadingMessagesFor(sessionId)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, created_at, attachment_filename')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (!error) {
      setMessagesBySession(prev => ({ ...prev, [sessionId]: data ?? [] }))
      setLoadingMessagesFor(null)
      return
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (fallbackError) {
      setMessageErrors(prev => ({ ...prev, [sessionId]: fallbackError.message }))
      setMessagesBySession(prev => ({ ...prev, [sessionId]: [] }))
    } else {
      const normalized = (fallbackData ?? []).map((message) => ({
        ...message,
        attachment_filename: null,
      }))
      setMessagesBySession(prev => ({ ...prev, [sessionId]: normalized }))
    }
    setLoadingMessagesFor(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
      <button
        type="button"
        onClick={handleToggleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}
      >
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
          Past sessions
        </span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '20px' }}>
          {loadingSessions && <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading…</p>}
          {sessionsError && <p style={{ fontSize: '12px', color: 'var(--danger)' }}>{sessionsError}</p>}
          {!loadingSessions && sessions?.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No past sessions.</p>}
          {sessions?.map(s => {
            const isExpanded = expandedId === s.id
            const msgs = messagesBySession[s.id]
            return (
              <div key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => handleToggleSession(s.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', textAlign: 'left' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{formatDate(s.started_at)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {s.opened_with_nudge && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)' }}>nudge</span>}
                    <ChevronIcon open={isExpanded} />
                  </div>
                </button>
                {isExpanded && (
                  <div style={{ paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loadingMessagesFor === s.id && <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Loading…</p>}
                    {messageErrors[s.id] && <p style={{ fontSize: '12px', color: 'var(--danger)' }}>{messageErrors[s.id]}</p>}
                    {msgs?.map(m => (
                      <div key={m.id}>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
                          {m.role === 'user' ? 'You' : 'Reed'}
                        </p>
                        {m.attachment_filename && <TranscriptAttachmentChip filename={m.attachment_filename} />}
                        {m.content.trim() && (
                          <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Main sidebar ── */
export function SessionMemoryPeek({
  sessionContext,
}: {
  isRefreshing?: boolean
  sessionContext: SessionContext
}) {
  const { activeGoals, behavioralSignals, openCommitments, overdueCommitment, recentSessions } = sessionContext

  return (
    <aside className="memory-sidebar">

      {/* Sidebar header */}
      <div className="memory-sidebar-header">
        <div>
          <span>Reed</span>
          <p>Memory</p>
        </div>
        <div className="memory-live">
          <span />
          Active
        </div>
      </div>

      {/* Content */}
      <div className="memory-sidebar-content">

        <p className="memory-eyebrow">What Reed carries</p>

        {/* Goals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <SectionHeader icon={<GoalIcon />} label="Goal" />
          {activeGoals.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '20px' }}>None yet.</p>
          ) : (
            activeGoals.map(g => (
              <p key={g.id} style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, paddingLeft: '20px' }}>
                {g.title}
              </p>
            ))
          )}
        </div>

        {/* Patterns / Behavioral signals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <SectionHeader icon={<PatternIcon />} label="Patterns" />
          {behavioralSignals.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '20px' }}>None yet.</p>
          ) : (
            behavioralSignals.map(s => (
              <div key={s.id} style={{ paddingLeft: '20px', marginBottom: '4px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {s.description}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {s.occurrence_count}× observed
                </p>
              </div>
            ))
          )}
        </div>

        {/* Open commitments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <SectionHeader icon={<CommitmentIcon />} label="Open" />
          {openCommitments.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '20px' }}>None.</p>
          ) : (
            openCommitments.map(c => {
              const isOverdue = c.id === overdueCommitment?.id
              return (
                <div
                  key={c.id}
                  style={{
                    padding: '9px 11px',
                    background: 'var(--accent-bg)',
                    borderRadius: '3px',
                    borderLeft: '2px solid #fb923c',
                    marginBottom: '4px',
                  }}
                >
                  <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{c.description}</p>
                  {(c.target_timeframe || isOverdue) && (
                    <p style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px', fontWeight: 600 }}>
                      {isOverdue ? `${c.target_timeframe ?? 'this week'} · overdue` : c.target_timeframe}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Past conversations */}
        <PastConversations initialSessions={recentSessions} />

      </div>
    </aside>
  )
}
