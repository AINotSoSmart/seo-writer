# Security Configuration Guide

This application includes several optional security features that can be enabled or disabled based on your needs. This guide explains how to configure each feature.

## 🛡️ Rate Limiting

Rate limiting protects your application from abuse by limiting the number of requests users can make within specific time windows.

### How to Enable Rate Limiting

1. **Set up Upstash Redis** (free tier available):
   - Go to [Upstash Console](https://console.upstash.com/)
   - Create a new Redis database
   - Copy the REST URL and REST Token

2. **Add environment variables** to your `.env.local`:
   ```env
   UPSTASH_REDIS_REST_URL=your_redis_url_here
   UPSTASH_REDIS_REST_TOKEN=your_redis_token_here
   ```

3. **Rate limiting will be automatically enabled** when these variables are present.

### How to Disable Rate Limiting

Simply comment out or remove the Upstash environment variables from your `.env.local`:
```env
# UPSTASH_REDIS_REST_URL=your_redis_url_here
# UPSTASH_REDIS_REST_TOKEN=your_redis_token_here
```

### Rate Limit Configuration

You can customize rate limits in `config/security.ts`:

```typescript
rateLimit: {
  auth: {
    requests: 5,        // 5 requests
    window: '15 m',     // per 15 minutes
  },
  api: {
    requests: 100,      // 100 requests
    window: '1 h',      // per hour
  }
}
```

## 🔒 CSRF Protection

CSRF (Cross-Site Request Forgery) protection is **enabled by default** for all critical server actions.

### How it Works
- Automatically generates CSRF tokens for forms
- Validates tokens on server actions
- Protects against malicious cross-site requests

### Configuration

CSRF settings can be modified in `config/security.ts`:

```typescript
csrf: {
  enabled: true,
  tokenExpiry: 60 * 60 * 1000, // 1 hour
}
```

## 🚨 Error Boundaries

Error boundaries catch JavaScript errors and display generic messages instead of exposing sensitive error details.

### Features
- **Enabled by default** in production
- Shows detailed errors in development
- Prevents sensitive information leakage
- Provides user-friendly error messages

### Configuration

Error boundary settings in `config/security.ts`:

```typescript
errorBoundary: {
  enabled: true,
  showErrorDetails: process.env.NODE_ENV === 'development',
}
```

**NODE_ENV Values:**
- `development` - Shows detailed error messages and stack traces
- `production` - Shows generic user-friendly error messages only
- `test` - Shows detailed errors for debugging tests

## 🔐 Row Level Security (RLS)

Database-level security policies are implemented for all tables:

### Covered Tables
- `dodo_payments` - Users can only access their own payment records
- `dodo_subscriptions` - Users can only access their own subscriptions
- `dodo_pricing_plans` - Public read access for active plans
- `dodo_webhook_events` - Service role access only
- `credits` - Users can only access their own credit records

### RLS Policies
All policies are defined in `utils/supabase/migrations/` directory:
- `dodo_rls_policies.sql` - Main payment system policies
- `credits_rls_policies.sql` - User credits policies

## 📊 Security Logging

The application logs security-related events for monitoring:

### Logged Events
- Authentication attempts (without sensitive data)
- Rate limit violations
- CSRF token validation failures
- Error boundary activations

### Configuration

Logging settings in `config/security.ts`:

```typescript
logging: {
  authEvents: true,
  rateLimitViolations: true,
  csrfFailures: true,
}
```

## 🚀 Quick Setup for Different Environments

### Development (Minimal Security)
```env
# .env.local - Development setup
NODE_ENV=development
# Rate limiting disabled (no Redis variables)
# CSRF enabled by default
# Error boundaries show detailed errors
```

### Production (Full Security)
```env
# .env.local - Production setup
NODE_ENV=production
UPSTASH_REDIS_REST_URL=your_redis_url_here
UPSTASH_REDIS_REST_TOKEN=your_redis_token_here
# All security features enabled
# Generic error messages only
```

### Testing (Flexible)
```env
# .env.local - Testing setup
NODE_ENV=test
# Comment/uncomment Redis variables as needed
# Adjust rate limits in config/security.ts for testing
```

## 🔧 Troubleshooting

### Rate Limiting Issues
- **Build fails with Redis errors**: Make sure Redis environment variables are commented out or have valid values
- **Rate limits too strict**: Adjust values in `config/security.ts`
- **Rate limiting not working**: Verify Upstash Redis credentials and network connectivity

### CSRF Issues
- **Form submissions failing**: Ensure `CSRFInput` component is included in forms
- **Token validation errors**: Check if `CSRFProvider` wraps the form components

### Error Boundary Issues
- **Errors not caught**: Verify `ErrorBoundary` component wraps the application in `layout.tsx`
- **Too much error detail shown**: Check `NODE_ENV` and error boundary configuration

## 📚 Additional Resources

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Security Best Practices](https://nextjs.org/docs/advanced-features/security-headers)
- [OWASP Security Guidelines](https://owasp.org/www-project-top-ten/)