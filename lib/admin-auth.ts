import { createHmac, timingSafeEqual } from 'crypto'

export const ADMIN_SESSION_COOKIE = 'hotel_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12

type AdminSession = {
  sub: 'admin'
  exp: number
}

function getSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    'hotel-assistant-local-admin-secret'
  )
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function base64UrlDecode(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  return Buffer.from(
    padded.replaceAll('-', '+').replaceAll('_', '/'),
    'base64'
  ).toString('utf8')
}

function sign(payload: string) {
  return base64UrlEncode(
    createHmac('sha256', getSessionSecret()).update(payload).digest()
  )
}

export function createAdminSessionToken() {
  const session: AdminSession = {
    sub: 'admin',
    exp: Date.now() + ADMIN_SESSION_MAX_AGE * 1000,
  }
  const payload = base64UrlEncode(JSON.stringify(session))
  return `${payload}.${sign(payload)}`
}

export function verifyAdminSessionToken(token?: string) {
  if (!token) return false

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

  const expectedSignature = sign(payload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as AdminSession
    return session.sub === 'admin' && session.exp > Date.now()
  } catch {
    return false
  }
}

export function isValidAdminLogin(username: string, password: string) {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'Hotel@2026'

  return username === adminUsername && password === adminPassword
}
