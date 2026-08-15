import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { isRateLimitingEnabled, getRateLimitConfig } from '@/config/security'

// Create Redis instance only if rate limiting is enabled
let redis: Redis | null = null
let authRateLimit: Ratelimit | null = null
let apiRateLimit: Ratelimit | null = null

if (isRateLimitingEnabled()) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  const rateLimitConfig = getRateLimitConfig()
  
  // Rate limiter for authentication endpoints
  authRateLimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(rateLimitConfig.auth.requests, rateLimitConfig.auth.window),
    analytics: true,
  })

  // Rate limiter for general API endpoints
  apiRateLimit = new Ratelimit({
    redis: redis,
    limiter: Ratelimit.slidingWindow(rateLimitConfig.api.requests, rateLimitConfig.api.window),
    analytics: true,
  })
}

export { authRateLimit, apiRateLimit }

// Helper function to get client IP
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  return 'unknown'
}

// Helper function to check rate limit and return appropriate response
export async function checkRateLimit(
  identifier: string,
  rateLimit: Ratelimit | null
): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number }> {
  // If rate limiting is disabled or rateLimit is null, allow all requests
  if (!isRateLimitingEnabled() || !rateLimit) {
    return { success: true }
  }

  try {
    const { success, limit, remaining, reset } = await rateLimit.limit(identifier)
    return { success, limit, remaining, reset }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // If rate limiting fails, allow the request to proceed
    return { success: true }
  }
}