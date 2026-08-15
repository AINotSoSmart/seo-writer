/**
 * Security Configuration
 * 
 * This file contains security-related configuration options that can be easily
 * enabled or disabled based on your application's needs.
 */

export const securityConfig = {
  /**
   * Rate Limiting Configuration
   * 
   * Rate limiting helps protect your application from abuse by limiting
   * the number of requests a user can make within a specific time window.
   * 
   * To enable rate limiting:
   * 1. Set up an Upstash Redis instance (https://upstash.com/)
   * 2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your .env.local
   * 3. The system will automatically detect and enable rate limiting
   * 
   * To disable rate limiting:
   * - Simply comment out or remove the Upstash environment variables
   */
  rateLimit: {
    // Authentication endpoints (login, signup, password reset)
    auth: {
      requests: 5,        // Number of requests allowed
      window: '15 m' as const,     // Time window (15 minutes)
    },
    // General API endpoints
    api: {
      requests: 100,      // Number of requests allowed
      window: '1 h' as const,      // Time window (1 hour)
    }
  },

  /**
   * CSRF Protection Configuration
   * 
   * CSRF (Cross-Site Request Forgery) protection helps prevent malicious
   * websites from making unauthorized requests on behalf of your users.
   * 
   * This is enabled by default for all critical server actions.
   */
  csrf: {
    enabled: true,
    tokenExpiry: 60 * 60 * 1000, // 1 hour in milliseconds
  },

  /**
   * Error Boundary Configuration
   * 
   * Error boundaries catch JavaScript errors and display generic messages
   * to users instead of exposing sensitive error details.
   * 
   * This is enabled by default for better security and user experience.
   */
  errorBoundary: {
    enabled: true,
    showErrorDetails: process.env.NODE_ENV === 'development',
  },

  /**
   * Logging Configuration
   * 
   * Controls what information is logged for security and debugging purposes.
   */
  logging: {
    // Log authentication events (without sensitive data)
    authEvents: true,
    // Log rate limit violations
    rateLimitViolations: true,
    // Log CSRF token validation failures
    csrfFailures: true,
  }
}

/**
 * Helper function to check if rate limiting is enabled
 * This checks for the presence of required environment variables
 */
export const isRateLimitingEnabled = (): boolean => {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Helper function to get rate limit configuration
 */
export const getRateLimitConfig = () => {
  return securityConfig.rateLimit
}

/**
 * Helper function to check if CSRF protection is enabled
 */
export const isCSRFEnabled = (): boolean => {
  return securityConfig.csrf.enabled
}

/**
 * Helper function to check if error boundaries are enabled
 */
export const isErrorBoundaryEnabled = (): boolean => {
  return securityConfig.errorBoundary.enabled
}