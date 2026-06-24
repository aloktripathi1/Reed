import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')

  if (!existsSync(envPath)) {
    return
  }

  const envFile = readFileSync(envPath, 'utf8')

  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadLocalEnv()

const DEMO_EMAIL = 'maya@demo.reed'
const demoPassword = process.env.DEMO_USER_PASSWORD

function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const IDS = {
  goal: '0db9300e-bd95-4f2a-b52d-9d3d98fbe8de',
  signal: 'f6be5c7a-6446-4c28-a3da-c37f6d337987',
  commitment: '95734972-c9fc-4e2c-9ff0-29f926e11175',
  sessionOne: '6ca5c7ca-6087-4ed4-a09c-1b88d8313046',
  sessionTwo: '7ef5b57e-aa85-42ba-bdf6-1effb0e47d9c',
  messages: {
    s1a: '79ad9787-ca67-4910-9fd8-e923cece9b1c',
    s1b: '7430a946-383f-43a3-9b55-fc3a93058cf3',
    s1c: 'db63e11d-aac7-4c0b-8399-771e06fb9aec',
    s1d: '11936fd8-2804-45f6-8cf7-a348316f52a2',
    s2a: 'ffda503e-a8d5-4956-acab-0ad85c2db338',
    s2b: '182fe75c-f516-4aad-bf4f-70709db5f5b2',
    s2c: '14f38cf3-9efa-4c92-8269-5047d5168f00',
    s2d: 'b762a82a-fd13-4081-bc27-4afc8244a43a',
  },
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

async function getOrCreateDemoUser() {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })

  if (error) {
    throw error
  }

  const existingUser = data.users.find((user) => user.email === DEMO_EMAIL)
  if (existingUser) {
    if (demoPassword) {
      await admin.auth.admin.updateUserById(existingUser.id, { password: demoPassword })
    }
    return existingUser
  }

  if (!demoPassword) {
    throw new Error('Set DEMO_USER_PASSWORD in .env.local before running the seed script.')
  }

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: demoPassword,
    email_confirm: true,
    user_metadata: {
      full_name: 'Maya Chen',
    },
  })

  if (createError) {
    throw createError
  }

  return createdUser.user
}

async function seedLedger(userId: string) {
  const admin = createAdminClient()

  const { data: existingSessions, error: sessionsLookupError } = await admin
    .from('sessions')
    .select('id')
    .eq('user_id', userId)

  if (sessionsLookupError) throw sessionsLookupError

  const existingSessionIds = (existingSessions ?? []).map((session) => session.id)

  if (existingSessionIds.length > 0) {
    const { error: messagesDeleteError } = await admin
      .from('messages')
      .delete()
      .in('session_id', existingSessionIds)

    if (messagesDeleteError) throw messagesDeleteError
  }

  const { error: commitmentsDeleteError } = await admin
    .from('commitments')
    .delete()
    .eq('user_id', userId)

  if (commitmentsDeleteError) throw commitmentsDeleteError

  const { error: sessionsDeleteError } = await admin
    .from('sessions')
    .delete()
    .eq('user_id', userId)

  if (sessionsDeleteError) throw sessionsDeleteError

  const { error: signalsDeleteError } = await admin
    .from('behavioral_signals')
    .delete()
    .eq('user_id', userId)

  if (signalsDeleteError) throw signalsDeleteError

  const { error: goalsDeleteError } = await admin
    .from('goals')
    .delete()
    .eq('user_id', userId)

  if (goalsDeleteError) throw goalsDeleteError

  const twelveDaysAgo = isoDaysAgo(12)
  const fiveDaysAgo = isoDaysAgo(5)

  const { error: goalError } = await admin.from('goals').upsert({
    id: IDS.goal,
    user_id: userId,
    title: 'Decide between a data-analyst and product-adjacent path',
    description:
      'Maya is trying to test whether the product side is genuinely more compelling or just feels riskier.',
    status: 'active',
    created_at: twelveDaysAgo,
    updated_at: fiveDaysAgo,
  })

  if (goalError) throw goalError

  const { error: signalError } = await admin.from('behavioral_signals').upsert({
    id: IDS.signal,
    user_id: userId,
    type: 'doubt',
    description: 'Questions whether she has enough credibility for product-adjacent roles.',
    first_observed_at: twelveDaysAgo,
    last_observed_at: twelveDaysAgo,
    occurrence_count: 1,
    related_goal_id: IDS.goal,
  })

  if (signalError) throw signalError

  const { error: sessionOneError } = await admin.from('sessions').upsert({
    id: IDS.sessionOne,
    user_id: userId,
    started_at: twelveDaysAgo,
    ended_at: twelveDaysAgo,
    opened_with_nudge: false,
    nudge_commitment_id: null,
  })

  if (sessionOneError) throw sessionOneError

  const { error: commitmentError } = await admin.from('commitments').upsert({
    id: IDS.commitment,
    user_id: userId,
    description: 'apply to 2 product-adjacent roles',
    source_session_id: IDS.sessionOne,
    target_timeframe: 'this week',
    status: 'open',
    created_at: twelveDaysAgo,
    resolved_at: null,
  })

  if (commitmentError) throw commitmentError

  const { error: sessionTwoError } = await admin.from('sessions').upsert({
    id: IDS.sessionTwo,
    user_id: userId,
    started_at: fiveDaysAgo,
    ended_at: fiveDaysAgo,
    opened_with_nudge: false,
    nudge_commitment_id: null,
  })

  if (sessionTwoError) throw sessionTwoError

  const { error: messageError } = await admin.from('messages').upsert([
    {
      id: IDS.messages.s1a,
      session_id: IDS.sessionOne,
      role: 'user',
      content:
        "I'm torn between a safer data-analyst path and product-adjacent roles that feel more exciting.",
      created_at: twelveDaysAgo,
    },
    {
      id: IDS.messages.s1b,
      session_id: IDS.sessionOne,
      role: 'assistant',
      content:
        "Exciting isn't enough on its own. What would actually tell you whether the product side is real instead of just aspirational?",
      created_at: twelveDaysAgo,
    },
    {
      id: IDS.messages.s1c,
      session_id: IDS.sessionOne,
      role: 'user',
      content:
        "I could apply to a couple of product-adjacent roles this week and see whether I get any traction.",
      created_at: twelveDaysAgo,
    },
    {
      id: IDS.messages.s1d,
      session_id: IDS.sessionOne,
      role: 'assistant',
      content:
        "Good. Then don't turn this into a vague identity debate. Apply to 2 product-adjacent roles this week and use the response as data.",
      created_at: twelveDaysAgo,
    },
    {
      id: IDS.messages.s2a,
      session_id: IDS.sessionTwo,
      role: 'user',
      content:
        "Can you help tighten this bullet for a data-analyst application to Northbeam Analytics?",
      created_at: fiveDaysAgo,
    },
    {
      id: IDS.messages.s2b,
      session_id: IDS.sessionTwo,
      role: 'assistant',
      content:
        'Yes. The verb is fine, but the proof is weak. Add an outcome so it earns the space.',
      created_at: fiveDaysAgo,
    },
    {
      id: IDS.messages.s2c,
      session_id: IDS.sessionTwo,
      role: 'user',
      content:
        "I also sent another analyst application to Lattice & Co. I'm still not sure the product roles make sense.",
      created_at: fiveDaysAgo,
    },
    {
      id: IDS.messages.s2d,
      session_id: IDS.sessionTwo,
      role: 'assistant',
      content:
        "Uncertainty is fine. Avoiding the test you set for yourself isn't. We'll come back to that.",
      created_at: fiveDaysAgo,
    },
  ])

  if (messageError) throw messageError
}

async function main() {
  const user = await getOrCreateDemoUser()
  await seedLedger(user.id)
  console.log(`Seeded Reed demo data for ${DEMO_EMAIL} (${user.id}).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
