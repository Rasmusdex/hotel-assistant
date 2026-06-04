import { NextResponse } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  isValidAdminLogin,
} from '@/lib/admin-auth'

export async function POST(request: Request) {
  const { username, password } = await request.json()

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !isValidAdminLogin(username.trim(), password)
  ) {
    return NextResponse.json(
      { message: 'Kullanıcı adı veya şifre hatalı.' },
      { status: 401 }
    )
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, await createAdminSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/',
  })

  return response
}
