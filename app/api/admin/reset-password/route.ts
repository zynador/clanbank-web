import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { targetUserId, newPassword } = await req.json()

    if (!targetUserId || !newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Ungültige Parameter. Passwort mind. 6 Zeichen.' },
        { status: 400 }
      )
    }

    // Caller-Verifizierung: nur Admin darf diese Route nutzen
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ success: false, message: 'Nicht autorisiert.' }, { status: 401 })
    }

    const callerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: roleData, error: roleError } = await callerClient.rpc('get_my_role')
    if (roleError || roleData !== 'admin') {
      return NextResponse.json({ success: false, message: 'Nur Admins erlaubt.' }, { status: 403 })
    }

    // Service Role Client — nur serverseitig
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    })

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Passwort erfolgreich gesetzt.' })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Serverfehler.' }, { status: 500 })
  }
}
