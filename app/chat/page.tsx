import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  buildOpeningMessage,
  getSessionContext,
} from '@/lib/coaching-logic/session-context'
import { ReedApp } from '@/components/reed-app'

export default async function ChatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const sessionContext = await getSessionContext(supabase, user.id)
  const openingMessage = buildOpeningMessage(sessionContext)

  return (
    <ReedApp
      initialOpeningMessage={openingMessage}
      initialOverdueCommitmentId={sessionContext.overdueCommitment?.id ?? null}
      initialSessionContext={sessionContext}
      initialSessionId={crypto.randomUUID()}
      userEmail={user.email ?? 'maya@demo.reed'}
    />
  )
}
