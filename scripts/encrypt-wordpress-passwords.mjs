/**
 * One-off: seal every plain-text WordPress application password.
 *
 *   TOKEN_ENCRYPTION_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/encrypt-wordpress-passwords.mjs
 *
 * Idempotent: rows already carrying the `enc:v1:` prefix are skipped. Uses the
 * same AES-256-GCM layout as lib/encryption.ts (IV 16 | tag 16 | ciphertext).
 */
import crypto from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "base64")
if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes")

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
)

function seal(plaintext) {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
    return `enc:v1:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64")}`
}

const { data, error } = await supabase.from("wordpress_connections").select("id, app_password")
if (error) throw error
let sealed = 0
for (const row of data) {
    if (String(row.app_password).startsWith("enc:v1:")) continue
    const { error: updateError } = await supabase
        .from("wordpress_connections")
        .update({ app_password: seal(row.app_password) })
        .eq("id", row.id)
    if (updateError) throw updateError
    sealed++
}
console.log(`Sealed ${sealed} of ${data.length} WordPress connection(s).`)
