import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data, error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    })

    if (error || !data.session) {
      console.error('[demo/login] signIn error:', error)
      return NextResponse.json({ message: 'Demo-Login fehlgeschlagen.' }, { status: 500 })
    }

    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
      .replace('https://', '')
      .split('.')[0]

    const cookieName = 'sb-' + projectRef + '-auth-token'

    const sessionValue = JSON.stringify([
      data.session.access_token,
      data.session.refresh_token,
    ])

    const res = NextResponse.json({ success: true })

    res.cookies.set(cookieName, sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })

    return res
  } catch (err) {
    console.error('[demo/login] unexpected error:', err)
    return NextResponse.json({ message: 'Serverfehler.' }, { status: 500 })
  }
}
