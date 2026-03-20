import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY env var must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32",
    )
  }
  return Buffer.from(hex, "hex")
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns the IV and ciphertext (with auth tag appended) as Buffers.
 */
export function encrypt(plaintext: string): { ciphertext: Buffer; iv: Buffer } {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ])

  return { ciphertext: encrypted, iv }
}

/**
 * Decrypts a ciphertext (with auth tag appended) using AES-256-GCM.
 */
export function decrypt(ciphertext: Buffer, iv: Buffer): string {
  const key = getKey()
  const authTag = ciphertext.subarray(ciphertext.length - AUTH_TAG_LENGTH)
  const encryptedData = ciphertext.subarray(
    0,
    ciphertext.length - AUTH_TAG_LENGTH,
  )

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)

  return decipher.update(encryptedData) + decipher.final("utf8")
}

/**
 * Masks an API token for display: shows first 8 and last 4 characters.
 */
export function maskToken(token: string): string {
  if (token.length <= 16) return "••••••••"
  return `${token.slice(0, 8)}••••${token.slice(-4)}`
}
