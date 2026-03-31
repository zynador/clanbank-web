import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const DEMO_CLAN_ID = '00000000-0000-0000-0000-000000000002'

const DEMO_ACCOUNTS = {
  admin:    { email: 'demo-admin@clanbank.local',    password: 'DemoAdmin2026!',    ingame_name: 'DemoAdmin',    username: 'demoadmin',    role: 'admin' },
  offizier: { email: 'demo-offi@clanbank.local',     password: 'DemoOffi2026!',     ingame_name: 'DemoOffi',     username: 'demooffi',     role: 'offizier' },
  mitglied: { email: 'demo-mitglied@clanbank.local', password: 'DemoMitglied2026!', ingame_name: 'DemoMitglied', username: 'demomitglied', role: 'mitglied' },
}

type DemoAccount = typeof DEMO_ACCOUNTS[keyof typeof DEMO_ACCOUNTS]

async function getOrCreateDemoUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  account: DemoAccount
): Promise<string> {
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers()
  const found = existing?.users?.find((u) => u.email === account.email)
  if (found) return found.id

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
  })

  if (error || !created?.user) {
    throw new Error('createUser failed: ' + error?.message)
  }

  await supabaseAdmin.from('profiles').insert({
    id: created.user.id,
    clan_id: DEMO_CLAN_ID,
    username: account.username,
    ingame_name: account.ingame_name,
    role: account.role,
    is_test: true,
  } as never)

  return created.user.id
}

export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json() as { role: string }

    if (!role || !(role in DEMO_ACCOUNTS)) {
      return NextResponse.json({ message: 'Ungültige Rolle.' }, { status: 400 })
    }

    const account = DEMO_ACCOUNTS[role as keyof typeof DEMO_ACCOUNTS]

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    await getOrCreateDemoUser(supabaseAdmin, account)

    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    })

    if (error || !data.session) {
      console.error('[demo/login] signIn error:', error)
      return NextResponse.json({ message: 'Demo-Login fehlgeschlagen.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  } catch (err) {
    console.error('[demo/login] unexpected error:', err)
    return NextResponse.json({ message: 'Serverfehler.' }, { status: 500 })
  }
}
