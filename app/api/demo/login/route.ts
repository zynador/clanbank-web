import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const DEMO_CLAN_ID = '00000000-0000-0000-0000-000000000002'

const DEMO_ACCOUNTS = {
  admin:    { email: 'demo-admin@clanbank.local',    password: 'demo_admin_pw' },
  offizier: { email: 'demo-offi@clanbank.local',     password: 'demo_offi_pw' },
  mitglied: { email: 'demo-mitglied@clanbank.local', password: 'demo_mitglied_pw' },
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
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    })

    if (error || !data.session) {
      console.error('[demo/login] signIn error:', error)
      return NextResponse.json({ message: 'Demo-Login fehlgeschlagen.' }, { status: 500 })
    }

    const cookieStore = await cookies()

    cookieStore.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })

    cookieStore.set('sb-refresh-token', data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })

    return NextResponse.json({ success: true, clan_id: DEMO_CLAN_ID })
  } catch (err) {
    console.error('[demo/login] unexpected error:', err)
    return NextResponse.json({ message: 'Serverfehler.' }, { status: 500 })
  }
}
