import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16  // 128-bit IV for GCM
const TAG_LENGTH = 16 // 128-bit auth tag
const ENCODING: BufferEncoding = 'base64'

function getEncryptionKey(): Buffer {
    const key = process.env.TOKEN_ENCRYPTION_KEY
    if (!key) {
        throw new Error(
            'TOKEN_ENCRYPTION_KEY environment variable is not set. ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
        )
    }
    const decoded = Buffer.from(key, 'base64')
    if (decoded.length !== 32) {
        throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 32 bytes (256 bits) when base64-decoded.')
    }
    return decoded
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a single base64 string containing: IV + AuthTag + Ciphertext
 */
export function encryptToken(plaintext: string): string {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    const tag = cipher.getAuthTag()

    // Pack: [IV (16 bytes)] [AuthTag (16 bytes)] [Ciphertext (N bytes)]
    const packed = Buffer.concat([iv, tag, encrypted])
    return packed.toString(ENCODING)
}

/**
 * Decrypts a token that was encrypted with encryptToken().
 * Expects a base64 string containing: IV + AuthTag + Ciphertext
 */
export function decryptToken(encryptedData: string): string {
    const key = getEncryptionKey()
    const packed = Buffer.from(encryptedData, ENCODING)

    // Unpack: [IV (16 bytes)] [AuthTag (16 bytes)] [Ciphertext (N bytes)]
    const iv = packed.subarray(0, IV_LENGTH)
    const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(ciphertext)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString('utf8')
}
