'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import type { SessionContext } from '@/lib/coaching-logic/session-context'
import { createClient } from '@/lib/supabase/client'
import { SessionMemoryPeek } from '@/components/session-memory-peek'

type PendingAttachment = { filename: string; text: string }
type AccountMenuPosition = { left: number; top: number }

const MAX_ATTACHMENTS = 3

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}

function MarkdownText({ text }: { text: string }) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g)

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.startsWith('**') && segment.endsWith('**')) {
          return <strong key={`${segment}-${index}`}>{segment.slice(2, -2)}</strong>
        }

        return segment
      })}
    </>
  )
}

function ReedMark({ size = 34 }: { size?: number }) {
  return (
    <div className="reed-mark" style={{ height: size, width: size }}>
      <span />
    </div>
  )
}

function getInitial(email: string) {
  return email.trim().charAt(0).toUpperCase() || 'U'
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('The upload service returned an unexpected response. Please try again.')
  }

  return response.json() as Promise<T>
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
  attachmentFilenames,
  isNudge,
  message,
  text,
  time,
}: {
  attachmentFilenames?: string[]
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
          {attachmentFilenames && attachmentFilenames.length > 0 && (
            <div className={text.trim() ? 'message-attachment' : undefined}>
              {attachmentFilenames.map((filename) => (
                <AttachmentChip filename={filename} key={filename} />
              ))}
            </div>
          )}
          {text.trim() && (
            <p>
              <MarkdownText text={text} />
            </p>
          )}
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
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [messageAttachments, setMessageAttachments] = useState<Record<number, string[]>>({})
  const [sessionContext, setSessionContext] = useState(initialSessionContext)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [accountMenuPosition, setAccountMenuPosition] = useState<AccountMenuPosition | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const accountButtonRef = useRef<HTMLButtonElement | null>(null)
  const accountPopoverRef = useRef<HTMLDivElement | null>(null)
  const sendingAttachmentsRef = useRef<PendingAttachment[]>([])
  const hasHydratedRef = useRef(false)
  const [isRefreshingContext, startRefreshTransition] = useTransition()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function updateAccountMenuPosition() {
    const buttonRect = accountButtonRef.current?.getBoundingClientRect()
    if (!buttonRect) return

    const popoverWidth = 258
    const viewportPadding = 12

    setAccountMenuPosition({
      left: Math.min(
        window.innerWidth - popoverWidth - viewportPadding,
        Math.max(viewportPadding, buttonRect.right - popoverWidth)
      ),
      top: buttonRect.bottom + 10,
    })
  }

  function toggleAccountMenu() {
    if (!isAccountMenuOpen) {
      updateAccountMenuPosition()
      setIsAccountMenuOpen(true)
      return
    }

    setIsAccountMenuOpen(false)
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
        attachmentFilename:
          sendingAttachmentsRef.current.length > 0
            ? sendingAttachmentsRef.current.map((attachment) => attachment.filename).join(', ')
            : null,
        attachmentText:
          sendingAttachmentsRef.current.length > 0
            ? sendingAttachmentsRef.current
                .map((attachment) => `[Attached: ${attachment.filename}]\n${attachment.text}`)
                .join('\n\n')
            : null,
      }),
    }),
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target as Node

      if (
        !accountButtonRef.current?.contains(target) &&
        !accountPopoverRef.current?.contains(target)
      ) {
        setIsAccountMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    if (!isAccountMenuOpen) return

    updateAccountMenuPosition()
    window.addEventListener('resize', updateAccountMenuPosition)
    window.addEventListener('scroll', updateAccountMenuPosition, true)

    return () => {
      window.removeEventListener('resize', updateAccountMenuPosition)
      window.removeEventListener('scroll', updateAccountMenuPosition, true)
    }
  }, [isAccountMenuOpen])

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
    if ((!trimmed && pendingAttachments.length === 0) || status !== 'ready') return
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const attachmentSnapshot = pendingAttachments
    if (attachmentSnapshot.length > 0) {
      setMessageAttachments((prev) => ({
        ...prev,
        [messages.length]: attachmentSnapshot.map((attachment) => attachment.filename),
      }))
    }

    sendingAttachmentsRef.current = attachmentSnapshot
    setInput('')
    setPendingAttachments([])
    setAttachmentError(null)
    await sendMessage({ text: trimmed || ' ' })
    sendingAttachmentsRef.current = []
  }

  async function extractAttachment(file: File): Promise<PendingAttachment> {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/extract-pdf', { method: 'POST', body: formData })
      const payload = await readJsonResponse<{ text?: string; error?: string }>(response)
      if (!response.ok || !payload.text) {
        throw new Error(payload.error ?? 'Could not read that PDF.')
      }
      return { filename: file.name, text: payload.text }
    }

    if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
      return { filename: file.name, text: await file.text() }
    }

    throw new Error('Attach .txt or .pdf files.')
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (selectedFiles.length === 0) return

    setAttachmentError(null)

    const availableSlots = MAX_ATTACHMENTS - pendingAttachments.length
    if (availableSlots <= 0 || selectedFiles.length > availableSlots) {
      setAttachmentError(`You can attach up to ${MAX_ATTACHMENTS} files at once.`)
      return
    }

    try {
      const attachments = await Promise.all(selectedFiles.map(extractAttachment))
      setPendingAttachments((currentAttachments) => [...currentAttachments, ...attachments])
    } catch (readError) {
      setAttachmentError(readError instanceof Error ? readError.message : 'Could not read that file.')
    }
  }

  function removePendingAttachment(filename: string) {
    setPendingAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.filename !== filename)
    )
  }

  function msgTime(index: number): string {
    if (index === 0) return 'Just now'
    return 'Now'
  }

  const isStreaming = status === 'streaming'
  const isSubmitted = status === 'submitted'
  const isReady = status === 'ready'
  const hasUserMessage = messages.some((message) => String(message.role) === 'user')

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
            <div className="account-menu">
              <button
                aria-expanded={isAccountMenuOpen}
                aria-label="Open account menu"
                className="account-button"
                onClick={toggleAccountMenu}
                ref={accountButtonRef}
                type="button"
              >
                <span>{getInitial(userEmail)}</span>
              </button>
            </div>
            {isAccountMenuOpen && accountMenuPosition && createPortal(
              <div
                className="account-popover"
                ref={accountPopoverRef}
                role="menu"
                style={{ left: accountMenuPosition.left, top: accountMenuPosition.top }}
              >
                <div className="account-popover-header">
                  <span className="account-avatar">{getInitial(userEmail)}</span>
                  <div>
                    <strong>Signed in</strong>
                    <p>{userEmail}</p>
                  </div>
                </div>
                <button onClick={handleSignOut} role="menuitem" type="button">
                  <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  Sign out
                </button>
              </div>,
              document.body
            )}
          </div>
        </header>

        <section className="message-list" aria-live="polite">
          <div className="message-list-inner">
            {messages.map((message, index) => {
              const text = getMessageText(message)
              const isNudge = index === 0 && message.role === 'assistant' && initialOverdueCommitmentId !== null
              const isDefaultOpening =
                index === 0 &&
                message.role === 'assistant' &&
                initialOverdueCommitmentId === null &&
                text.trim() === initialOpeningMessage.trim()

              if (hasUserMessage && isDefaultOpening) {
                return null
              }

              return (
                <MessageBubble
                  attachmentFilenames={messageAttachments[index]}
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
            {pendingAttachments.length > 0 && (
              <div className="composer-attachment">
                {pendingAttachments.map((attachment) => (
                  <AttachmentChip
                    filename={attachment.filename}
                    key={attachment.filename}
                    onRemove={() => removePendingAttachment(attachment.filename)}
                  />
                ))}
              </div>
            )}

            <div className="composer-box">
              <input
                ref={fileInputRef}
                accept=".txt,.pdf,text/plain,application/pdf"
                multiple
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
                disabled={!isReady || (!input.trim() && pendingAttachments.length === 0)}
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
