import { decryptToken, encryptToken } from "@/lib/encryption"

/**
 * WordPress application passwords at rest.
 *
 * They used to be stored in plain text. New and updated connections are sealed
 * with AES-256-GCM (`lib/encryption.ts`, key `TOKEN_ENCRYPTION_KEY`) behind a
 * version prefix, so rows written before this change still open:
 * `scripts/encrypt-wordpress-passwords.mjs` re-seals them in place.
 */
const SEALED_PREFIX = "enc:v1:"

export function sealAppPassword(plaintext: string): string {
    if (plaintext.startsWith(SEALED_PREFIX)) return plaintext
    if (!process.env.TOKEN_ENCRYPTION_KEY) {
        // Refusing to save would lock the owner out of WordPress entirely on a
        // deployment that has not set the key yet; say so loudly instead.
        console.warn("[wordpress-credentials] TOKEN_ENCRYPTION_KEY is not set; storing the app password unencrypted.")
        return plaintext
    }
    return `${SEALED_PREFIX}${encryptToken(plaintext)}`
}

export function openAppPassword(stored: string): string {
    if (!stored.startsWith(SEALED_PREFIX)) return stored
    return decryptToken(stored.slice(SEALED_PREFIX.length))
}

export function wordpressAuthHeader(connection: { username: string; app_password: string }): string {
    const password = openAppPassword(connection.app_password)
    return `Basic ${Buffer.from(`${connection.username}:${password}`).toString("base64")}`
}
