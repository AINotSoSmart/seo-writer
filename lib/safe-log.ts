/**
 * Redaction helpers for logging.
 *
 * Logging a caught error object wholesale can print whatever context the thrown
 * object carries. For Supabase auth errors that can include session material —
 * access tokens, refresh tokens, provider tokens — which then sits in plaintext
 * in dev output and in any log aggregator.
 *
 * Use `safeError()` instead of passing an error object straight to console.
 */

const SENSITIVE_KEY_PATTERN =
    /(access_token|refresh_token|provider_token|provider_refresh_token|id_token|session|password|secret|api[_-]?key|authorization|cookie)/i

/** Anything that looks like a JWT, regardless of the key it sits under */
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g

/**
 * Reduces an unknown thrown value to a loggable message.
 * Never returns the original object, so nothing can ride along inside it.
 */
export function safeError(error: unknown): string {
    if (error instanceof Error) {
        return redactString(`${error.name}: ${error.message}`)
    }
    if (typeof error === "string") {
        return redactString(error)
    }
    if (error && typeof error === "object") {
        const record = error as Record<string, unknown>
        const parts: string[] = []
        for (const key of ["code", "status", "name", "message"]) {
            if (record[key] !== undefined && !SENSITIVE_KEY_PATTERN.test(key)) {
                parts.push(`${key}=${String(record[key])}`)
            }
        }
        return parts.length > 0 ? redactString(parts.join(" ")) : "non-error object thrown"
    }
    return "unknown error"
}

/** Masks JWT-shaped substrings anywhere in a string */
export function redactString(input: string): string {
    return input.replace(JWT_PATTERN, "[REDACTED_JWT]")
}
