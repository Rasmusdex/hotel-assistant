import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from '@/lib/admin-auth'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  if (!token) {
    return NextResponse.json(
      {
        authenticated: false,
        reason: 'missing_admin_session_cookie',
      },
      { status: 401 }
    )
  }

  const authenticated = await verifyAdminSessionToken(token)

  if (!authenticated) {
    return NextResponse.json(
      {
        authenticated: false,
        reason: 'invalid_or_expired_admin_session',
      },
      { status: 401 }
    )
  }

  return NextResponse.json({
    authenticated: true,
    reason: 'active_admin_session',
    checkedAt: new Date().toISOString(),
  })
}
