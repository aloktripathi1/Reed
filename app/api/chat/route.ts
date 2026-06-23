import { anthropic } from '@ai-sdk/anthropic'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { buildSystemPrompt } from '@/lib/chat/prompt'
import { PERSONA_MODEL } from '@/lib/chat/models'
import { getSessionContext } from '@/lib/coaching-logic/session-context'
import { extractAndPersistMemory } from '@/lib/memory/extraction'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

function getLatestUserText(messages: UIMessage[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')

  if (!latestUserMessage) {
    return ''
  }

  return latestUserMessage.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}

function isMissingAttachmentColumnError(error: { message?: string } | null) {
  return Boolean(error?.message?.includes('attachment_'))
}

async function ensureSessionExists({
  openingMessage,
  overdueCommitmentId,
  sessionId,
  userId,
}: {
  openingMessage: string
  overdueCommitmentId: string | null
  sessionId: string
  userId: string
}) {
  const admin = createAdminClient()
  const { data: existingSession, error: existingSessionError } = await admin
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existingSessionError) {
    throw existingSessionError
  }

  if (existingSession) {
    return
  }

  const { error: sessionInsertError } = await admin.from('sessions').insert({
    id: sessionId,
    user_id: userId,
    opened_with_nudge: overdueCommitmentId !== null,
    nudge_commitment_id: overdueCommitmentId,
  })

  if (sessionInsertError) {
    throw sessionInsertError
  }

  const { error: openerInsertError } = await admin.from('messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: openingMessage,
  })

  if (openerInsertError) {
    throw openerInsertError
  }
}

export async function POST(request: Request) {
  const {
    messages,
    openingMessage,
    overdueCommitmentId,
    sessionId,
    attachmentFilename,
    attachmentText,
  } = (await request.json()) as {
    messages: UIMessage[]
    openingMessage: string
    overdueCommitmentId: string | null
    sessionId: string
    attachmentFilename: string | null
    attachmentText: string | null
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  await ensureSessionExists({
    openingMessage,
    overdueCommitmentId: overdueCommitmentId ?? null,
    sessionId,
    userId: user.id,
  })

  const latestUserText = getLatestUserText(messages)
  const latestUserEffective = attachmentText
    ? [latestUserText, `[Attached file: ${attachmentFilename ?? 'attachment'}]\n${attachmentText}`]
        .filter((part) => part.trim())
        .join('\n\n')
    : latestUserText

  if (latestUserText.trim() || attachmentText?.trim()) {
    const admin = createAdminClient()
    const userMessageInsert = {
      session_id: sessionId,
      role: 'user',
      content: latestUserText,
      attachment_filename: attachmentFilename ?? null,
      attachment_text: attachmentText ?? null,
    } as const

    const { error } = await admin.from('messages').insert(userMessageInsert)

    if (error) {
      if (!isMissingAttachmentColumnError(error)) {
        throw error
      }

      const { error: fallbackError } = await admin.from('messages').insert({
        session_id: userMessageInsert.session_id,
        role: userMessageInsert.role,
        content: userMessageInsert.content,
      })

      if (fallbackError) {
        throw fallbackError
      }
    }
  }

  const sessionContext = await getSessionContext(supabase, user.id)
  let modelMessages = await convertToModelMessages(messages)

  if (attachmentText) {
    const lastUserIdx = modelMessages.reduce((acc, msg, index) => (msg.role === 'user' ? index : acc), -1)
    if (lastUserIdx !== -1) {
      const injectedText = `\n\n[Attached file: ${attachmentFilename ?? 'attachment'}]\n${attachmentText}`
      modelMessages = modelMessages.map((message, index) => {
        if (index !== lastUserIdx || message.role !== 'user') {
          return message
        }

        return {
          ...message,
          content:
            typeof message.content === 'string'
              ? message.content + injectedText
              : [...message.content, { type: 'text' as const, text: injectedText }],
        }
      })
    }
  }

  const result = streamText({
    model: anthropic(PERSONA_MODEL),
    system: buildSystemPrompt(sessionContext),
    messages: modelMessages,
  })

  return result.toUIMessageStreamResponse({
    async onFinish({ messages: responseMessages }) {
      const assistantMessage = responseMessages.at(-1)
      const assistantText = assistantMessage?.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n')

      if (!assistantText?.trim()) {
        return
      }

      const admin = createAdminClient()

      await admin.from('messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: assistantText,
      })

      extractAndPersistMemory({
        assistantMessage: assistantText,
        latestUserMessage: latestUserEffective,
        sessionContext,
        userId: user.id,
      }).catch((error) => {
        console.error('Memory extraction failed:', error)
      })
    },
  })
}
