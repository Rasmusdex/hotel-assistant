export const ADMIN_SESSION_COOKIE = 'hotel_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 365

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

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function base64UrlToBytes(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function base64UrlEncode(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value))
}

function base64UrlDecode(value: string) {
  return new TextDecoder().decode(base64UrlToBytes(value))
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false

  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return result === 0
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  )

  return bytesToBase64Url(new Uint8Array(signature))
}

export async function createAdminSessionToken() {
  const session: AdminSession = {
    sub: 'admin',
    exp: Date.now() + ADMIN_SESSION_MAX_AGE * 1000,
  }
  const payload = base64UrlEncode(JSON.stringify(session))
  return `${payload}.${await sign(payload)}`
}

export async function verifyAdminSessionToken(token?: string) {
  if (!token) return false

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

  const expectedSignature = await sign(payload)
  if (!constantTimeEqual(signature, expectedSignature)) return false

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
