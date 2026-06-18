import "server-only"
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

/**
 * The current encryption key version. New ciphertexts are written with this
 * version. Bump it when rotating keys (and provision the new key under
 * `ENCRYPTION_KEY_V{n}` before deploying).
 */
export const CURRENT_KEY_VERSION = 1

/**
 * Resolve the AES-256 key for a given version.
 *
 * Lookup order:
 *   1. `ENCRYPTION_KEY_V{version}` env var
 *   2. For version 1 only: fall back to legacy `ENCRYPTION_KEY` so existing
 *      deployments keep working without an env rename.
 *
 * @throws if the env var is missing or not a 64-char hex string.
 */
function getKeyForVersion(version: number): Buffer {
  const versionedEnv = `ENCRYPTION_KEY_V${version}`
  const hex =
    process.env[versionedEnv] ??
    (version === 1 ? process.env.ENCRYPTION_KEY : undefined)
  if (!hex || hex.length !== 64) {
    const hint =
      version === 1
        ? `Set ${versionedEnv} or ENCRYPTION_KEY (legacy) to a 64-char hex string. Generate with: openssl rand -hex 32`
        : `Set ${versionedEnv} to a 64-char hex string. Generate with: openssl rand -hex 32`
    throw new Error(
      `Encryption key for version ${version} is not available. ${hint}`,
    )
  }
  return Buffer.from(hex, "hex")
}

export interface EncryptResult {
  ciphertext: Buffer
  iv: Buffer
  keyVersion: number
}

/**
 * Encrypt a plaintext string using AES-256-GCM with the current key version.
 *
 * Returns the IV, ciphertext (with auth tag appended), and the key version
 * used. Persist all three so {@link decrypt} can dispatch to the right key
 * after a rotation.
 *
 * Rotation runbook (when bumping {@link CURRENT_KEY_VERSION}):
 *   1. Provision the new key in `ENCRYPTION_KEY_V{n+1}` env var.
 *   2. Deploy with the bumped `CURRENT_KEY_VERSION`. Old reads still work
 *      because old rows carry their original `keyVersion`.
 *   3. Run a one-shot script that re-encrypts every stored token with the
 *      new version, updating the `*KeyVersion` column.
 *   4. After confirmed re-encryption, the old env var can be retired.
 */
export function encrypt(plaintext: string): EncryptResult {
  const keyVersion = CURRENT_KEY_VERSION
  const key = getKeyForVersion(keyVersion)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ])

  return { ciphertext: encrypted, iv, keyVersion }
}

/**
 * Decrypt a ciphertext (with auth tag appended) using AES-256-GCM, looking
 * up the key by stored `keyVersion`. Pass the same version that was returned
 * from {@link encrypt}.
 *
 * @throws if the key for that version is missing, the auth tag fails, or the
 *   ciphertext was tampered with.
 */
export function decrypt(
  ciphertext: Buffer,
  iv: Buffer,
  keyVersion: number,
): string {
  const key = getKeyForVersion(keyVersion)
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
 * Mask an API token for display: shows first 8 and last 4 characters.
 */
export function maskToken(token: string): string {
  if (token.length <= 16) return "••••••••"
  return `${token.slice(0, 8)}••••${token.slice(-4)}`
}
