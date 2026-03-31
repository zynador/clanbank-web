import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const DEMO_ACCOUNTS = {
  admin:    { email: 'demo-admin@clanbank.local' },
  offizier: { email: 'demo-offi@clanbank.local' },
  mitglied: { email: 'demo-mitglied@clanbank.local' },
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

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: account.email,
    })

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('[demo/login] generateLink error:', linkError)
      return NextResponse.json({ message: 'Demo-Login fehlgeschlagen.' }, { status: 500 })
    }

    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: sessionData, error: sessionError } = await supabaseAnon.auth.verifyOtp({
      email: account.email,
      token: linkData.properties.hashed_token,
      type: 'magiclink',
    })

    if (sessionError || !sessionData?.session) {
      console.error('[demo/login] verifyOtp error:', sessionError)
      return NextResponse.json({ message: 'Demo-Login fehlgeschlagen.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    })
  } catch (err) {
    console.error('[demo/login] unexpected error:', err)
    return NextResponse.json({ message: 'Serverfehler.' }, { status: 500 })
  }
}
