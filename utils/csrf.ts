import { createHash, randomBytes } from 'crypto'
import { cookies } from 'next/headers'

export const CSRF_TOKEN_NAME = 'csrf-token'
export const CSRF_SECRET_NAME = 'csrf-secret'
export const CSRF_CLIENT_TOKEN_NAME = 'csrf-token-client'
const TOKEN_LENGTH = 32

// Generate a random secret for CSRF token generation
export function generateSecret(): string {
  return randomBytes(TOKEN_LENGTH).toString('hex')
}

// Generate CSRF token based on secret
export function generateToken(secret: string): string {
  const timestamp = Date.now().toString()
  const hash = createHash('sha256')
    .update(secret + timestamp)
    .digest('hex')
  return `${timestamp}.${hash}`
}

// Validate CSRF token
function validateToken(token: string, secret: string): boolean {
  try {
    const [timestamp, hash] = token.split('.')
    if (!timestamp || !hash) return false
    
    // Check if token is not older than 1 hour
    const tokenTime = parseInt(timestamp)
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    
    if (now - tokenTime > oneHour) {
      return false
    }
    
    // Verify hash
    const expectedHash = createHash('sha256')
      .update(secret + timestamp)
      .digest('hex')
    
    return hash === expectedHash
  } catch {
    return false
  }
}

// Get or create CSRF token for the current session
export async function getCSRFToken(): Promise<string> {
  const cookieStore = await cookies()
  
  let secret = cookieStore.get(CSRF_SECRET_NAME)?.value
  if (!secret) {
    secret = generateSecret()
    cookieStore.set(CSRF_SECRET_NAME, secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
    })
  }
  
  const token = generateToken(secret)
  cookieStore.set(CSRF_TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60, // 1 hour
  })
  
  return token
}

// Validate CSRF token from request
export async function validateCSRFToken(submittedToken: string): Promise<boolean> {
  const cookieStore = await cookies()
  
  const secret = cookieStore.get(CSRF_SECRET_NAME)?.value
  
  if (!secret || !submittedToken) {
    return false
  }
  
  // Validate the submitted token against the secret
  return validateToken(submittedToken, secret)
}

// Middleware to check CSRF token for server actions
export async function requireCSRFToken(formData: FormData): Promise<boolean> {
  const submittedToken = formData.get('csrf-token') as string
  
  if (!submittedToken) {
    console.error('CSRF token missing from form submission')
    return false
  }
  
  const isValid = await validateCSRFToken(submittedToken)
  
  if (!isValid) {
    console.error('Invalid CSRF token submitted')
    return false
  }
  
  return true
}

// Get CSRF token for client-side use (non-httpOnly version)
export async function getClientCSRFToken(): Promise<string> {
  const cookieStore = await cookies()
  
  let secret = cookieStore.get(CSRF_SECRET_NAME)?.value
  if (!secret) {
    secret = generateSecret()
    cookieStore.set(CSRF_SECRET_NAME, secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
    })
  }
  
  const token = generateToken(secret)
  
  // Set both server and client accessible versions for compatibility
  cookieStore.set(CSRF_TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60, // 1 hour
  })
  
  cookieStore.set('csrf-token-client', token, {
    httpOnly: false, // Accessible to client-side JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60, // 1 hour
  })
  
  return token
}