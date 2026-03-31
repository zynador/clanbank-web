import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const DEMO_CLAN_ID = '00000000-0000-0000-0000-000000000002'

const DEMO_ACCOUNTS = {
  admin:    { email: 'demo-admin@clanbank.local',    password: 'DemoAdmin2026!',    ingame_name: 'DemoAdmin',    username: 'demoadmin',    role: 'admin' },
  offizier: { email: 'demo-offi@clanbank.local',     password: 'DemoOffi2026!',     ingame_name: 'DemoOffi',     username: 'demooffi',     role: 'offizier' },
  mitglied: { email: 'demo-mitglied@clanbank.local', password: 'DemoMitglied2026!', ingame_name: 'DemoMitglied', username: 'demomitglied', role: 'mitglied' },
}

type DemoAccount = typeof DEMO_ACCOUNTS[keyof typeof DEMO_ACCOUNTS]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureDemoUser(admin: SupabaseClient<any>, account: DemoAccount): Promise<void> {
  const { data: list } = await admin.auth.admin.listUsers()
  const exists = list?.users?.find((u) => u.email === account.email)
  if (exists) {
    await admin.auth.admin.updateUserById(exists.id, { password: account.password })
    return
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
  })

  if (error || !data?.user) throw new Error('createUser: ' + error?.message)

  await admin.from('profiles').insert({
    id: data.user.id,
    clan_id: DEMO_CLAN_ID,
    username: account.username,
    ingame_name: account.ingame_name,
    role: account.role,
    is_test: true,
  } as never)
}

export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json() as { role: string }
    if (!role || !(role in DEMO_ACCOUNTS)) {
      return NextResponse.json({ message: 'Ungültige Rolle.' }, { status: 400 })
    }

    const account = DEMO_ACCOUNTS[role as keyof typeof DEMO_ACCOUNTS]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin: SupabaseClient<any> = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    await ensureDemoUser(admin, account)

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data, error } = await anon.auth.signInWithPassword({
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
