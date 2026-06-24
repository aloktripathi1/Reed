'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import type { SessionContext } from '@/lib/coaching-logic/session-context'
import { createClient } from '@/lib/supabase/client'
import { SessionMemoryPeek } from '@/components/session-memory-peek'

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}

function ReedMark({ size = 34 }: { size?: number }) {
  return (
    <div className="reed-mark" style={{ height: size, width: size }}>
      <span />
    </div>
  )
}

function AttachmentChip({
  filename,
  onRemove,
}: {
  filename: string
  onRemove?: () => void
}) {
  return (
    <div className="attachment-chip">
      <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="15">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span>{filename}</span>
      {onRemove && (
        <button aria-label="Remove attachment" onClick={onRemove} type="button">
          <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13">
            <line x1="18" x2="6" y1="6" y2="18" />
            <line x1="6" x2="18" y1="6" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
}

function MessageBubble({
  attachmentFilename,
  isNudge,
  message,
  text,
  time,
}: {
  attachmentFilename?: string
  isNudge: boolean
  message: UIMessage
  text: string
  time: string
}) {
  const isUser = message.role === 'user'

  if (isNudge) {
    return (
      <article className="message-row message-row-nudge">
        <div className="nudge-note">
          <p>{text}</p>
          <span>Carried forward from your last session</span>
        </div>
      </article>
    )
  }

  return (
    <article className={`message-row ${isUser ? 'message-row-user' : 'message-row-reed'}`}>
      {!isUser && <ReedMark size={28} />}
      <div className="message-stack">
        <div className={`message-bubble ${isUser ? 'message-bubble-user' : 'message-bubble-reed'}`}>
          {attachmentFilename && (
            <div className={text.trim() ? 'message-attachment' : undefined}>
              <AttachmentChip filename={attachmentFilename} />
            </div>
          )}
          {text.trim() && <p>{text}</p>}
        </div>
        <span className="message-time">{time}</span>
      </div>
    </article>
  )
}

function TypingIndicator() {
  return (
    <article className="message-row message-row-reed">
      <ReedMark size={28} />
      <div className="typing-indicator" aria-label="Reed is thinking">
        <span />
        <span />
        <span />
      </div>
    </article>
  )
}

export function ReedApp({
  initialOpeningMessage,
  initialOverdueCommitmentId,
  initialSessionContext,
  initialSessionId,
  userEmail,
}: {
  initialOpeningMessage: string
  initialOverdueCommitmentId: string | null
  initialSessionContext: SessionContext
  initialSessionId: string
  userEmail: string
}) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<{ filename: string; text: string } | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [messageAttachments, setMessageAttachments] = useState<Record<number, string>>({})
  const [sessionContext, setSessionContext] = useState(initialSessionContext)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const sendingAttachmentRef = useRef<{ filename: string; text: string } | null>(null)
  const hasHydratedRef = useRef(false)
  const [isRefreshingContext, startRefreshTransition] = useTransition()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const { messages, sendMessage, status, error } = useChat({
    id: initialSessionId,
    messages: [
      {
        id: `${initialSessionId}-opening`,
        role: 'assistant',
        parts: [{ type: 'text', text: initialOpeningMessage }],
      },
    ],
    // The AI SDK invokes the body callback when a request is sent; the ref
    // carries the attachment snapshot for exactly that request.
    // eslint-disable-next-line react-hooks/refs
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({
        openingMessage: initialOpeningMessage,
        overdueCommitmentId: initialOverdueCommitmentId,
        sessionId: initialSessionId,
        attachmentFilename: sendingAttachmentRef.current?.filename ?? null,
        attachmentText: sendingAttachmentRef.current?.text ?? null,
      }),
    }),
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  useEffect(() => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true
      return
    }
    if (status !== 'ready') return
    startRefreshTransition(() => {
      fetch('/api/session-context', { cache: 'no-store' })
        .then(async (res) => {
          if (!res.ok) return
          const payload = (await res.json()) as { sessionContext: SessionContext }
          setSessionContext(payload.sessionContext)
        })
        .catch(() => undefined)
    })
  }, [status])

  function autoResize(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = input.trim()
    if ((!trimmed && !pendingAttachment) || status !== 'ready') return
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const attachmentSnapshot = pendingAttachment
    if (attachmentSnapshot) {
      setMessageAttachments((prev) => ({ ...prev, [messages.length]: attachmentSnapshot.filename }))
    }

    sendingAttachmentRef.current = attachmentSnapshot
    setInput('')
    setPendingAttachment(null)
    setAttachmentError(null)
    await sendMessage({ text: trimmed || ' ' })
    sendingAttachmentRef.current = null
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setAttachmentError(null)

    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/extract-pdf', { method: 'POST', body: formData })
        const payload = (await response.json()) as { text?: string; error?: string }
        if (!response.ok || !payload.text) {
          throw new Error(payload.error ?? 'Could not read that PDF.')
        }
        setPendingAttachment({ filename: file.name, text: payload.text })
        return
      }

      if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
        setPendingAttachment({ filename: file.name, text: await file.text() })
        return
      }

      throw new Error('Attach a .txt or .pdf file.')
    } catch (readError) {
      setPendingAttachment(null)
      setAttachmentError(readError instanceof Error ? readError.message : 'Could not read that file.')
    }
  }

  function msgTime(index: number): string {
    if (index === 0) return 'Just now'
    return 'Now'
  }

  const isStreaming = status === 'streaming'
  const isSubmitted = status === 'submitted'
  const isReady = status === 'ready'

  return (
    <div className="chat-shell">
      <SessionMemoryPeek sessionContext={sessionContext} isRefreshing={isRefreshingContext} />

      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-brand">
            <ReedMark />
            <div>
              <strong>Reed</strong>
              <span>Memory workspace</span>
            </div>
          </div>

          <div className="chat-header-actions">
            <span className={`status-pill ${isStreaming ? 'status-pill-live' : ''}`}>
              {isStreaming ? 'Thinking' : 'Ready'}
            </span>
            <span className="chat-user">{userEmail}</span>
            <button className="ghost-button" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <section className="message-list" aria-live="polite">
          <div className="message-list-inner">
            {messages.map((message, index) => {
              const text = getMessageText(message)
              const isNudge = index === 0 && message.role === 'assistant' && initialOverdueCommitmentId !== null

              return (
                <MessageBubble
                  attachmentFilename={messageAttachments[index]}
                  isNudge={isNudge}
                  key={message.id}
                  message={message}
                  text={text}
                  time={msgTime(index)}
                />
              )
            })}

            {isSubmitted && <TypingIndicator />}

            {error && (
              <div className="chat-error" role="alert">
                {error.message}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </section>

        <footer className="composer-wrap">
          <form className="composer" ref={formRef} onSubmit={handleSubmit}>
            <div className="composer-label">
              <span>Conversation</span>
              <span>Reed remembers useful context automatically</span>
            </div>
            {pendingAttachment && (
              <div className="composer-attachment">
                <AttachmentChip filename={pendingAttachment.filename} onRemove={() => setPendingAttachment(null)} />
              </div>
            )}

            <div className="composer-box">
              <input
                ref={fileInputRef}
                accept=".txt,.pdf,text/plain,application/pdf"
                onChange={handleFileSelect}
                type="file"
              />
              <button
                aria-label="Attach file"
                className="icon-button"
                disabled={!isReady}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="18">
                  <path d="M21.44 11.05 12 20.5a6 6 0 0 1-8.49-8.49l9.9-9.9a4 4 0 0 1 5.66 5.66l-9.9 9.9a2 2 0 0 1-2.83-2.83l9.19-9.19" />
                </svg>
              </button>
              <textarea
                ref={textareaRef}
                disabled={!isReady}
                onChange={(event) => {
                  setInput(event.target.value)
                  autoResize(event.target)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask Reed about a decision, role, resume, or commitment..."
                rows={1}
                value={input}
              />
              <button
                aria-label="Send message"
                className="send-button"
                disabled={!isReady || (!input.trim() && !pendingAttachment)}
                type="submit"
              >
                <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 18 18" width="18">
                  <path d="M3 14.5 15 9 3 3.5v4.25L10.5 9 3 10.25v4.25Z" fill="currentColor" />
                </svg>
              </button>
            </div>

            <div className="composer-meta">
              <span>Enter to send</span>
              {attachmentError && <span className="composer-error">{attachmentError}</span>}
            </div>
          </form>
        </footer>
      </main>
    </div>
  )
}
