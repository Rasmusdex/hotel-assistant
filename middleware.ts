import { NextResponse, type NextRequest } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from '@/lib/admin-auth'

export async function middleware(request: NextRequest) {
  const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value

  if (!(await verifyAdminSessionToken(session))) {
    const loginUrl = new URL('/admin-login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
