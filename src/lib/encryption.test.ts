import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { createCipheriv, randomBytes } from "crypto"

const TEST_KEY_V1 = "a".repeat(64)
const TEST_KEY_V2 = "b".repeat(64)

describe("encryption", () => {
  let encrypt: typeof import("./encryption").encrypt
  let decrypt: typeof import("./encryption").decrypt
  let CURRENT_KEY_VERSION: number

  beforeAll(async () => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY_V1)
    vi.stubEnv("ENCRYPTION_KEY_V2", TEST_KEY_V2)
    const mod = await import("./encryption")
    encrypt = mod.encrypt
    decrypt = mod.decrypt
    CURRENT_KEY_VERSION = mod.CURRENT_KEY_VERSION
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it("encrypts and decrypts a string roundtrip", () => {
    const plaintext = "my-secret-api-key-12345"
    const { ciphertext, iv, keyVersion } = encrypt(plaintext)

    expect(ciphertext).toBeInstanceOf(Buffer)
    expect(iv).toBeInstanceOf(Buffer)
    expect(iv.length).toBe(12)
    expect(keyVersion).toBe(CURRENT_KEY_VERSION)

    const decrypted = decrypt(ciphertext, iv, keyVersion)
    expect(decrypted).toBe(plaintext)
  })

  it("produces different ciphertexts for the same input (random IV)", () => {
    const plaintext = "same-input"
    const result1 = encrypt(plaintext)
    const result2 = encrypt(plaintext)

    expect(result1.ciphertext.equals(result2.ciphertext)).toBe(false)
    expect(result1.iv.equals(result2.iv)).toBe(false)
  })

  it("handles empty string", () => {
    const { ciphertext, iv, keyVersion } = encrypt("")
    expect(decrypt(ciphertext, iv, keyVersion)).toBe("")
  })

  it("handles unicode content", () => {
    const plaintext = "Hello, world!"
    const { ciphertext, iv, keyVersion } = encrypt(plaintext)
    expect(decrypt(ciphertext, iv, keyVersion)).toBe(plaintext)
  })

  it("fails to decrypt with tampered ciphertext", () => {
    const { ciphertext, iv, keyVersion } = encrypt("secret")
    ciphertext[0] = (ciphertext[0] ?? 0) ^ 0xff
    expect(() => decrypt(ciphertext, iv, keyVersion)).toThrow()
  })

  it("fails to decrypt with wrong IV", () => {
    const { ciphertext, keyVersion } = encrypt("secret")
    const wrongIv = Buffer.alloc(12, 0)
    expect(() => decrypt(ciphertext, wrongIv, keyVersion)).toThrow()
  })

  it("fails to decrypt v1 ciphertext with v2 key", async () => {
    const { ciphertext, iv } = encrypt("secret")
    expect(() => decrypt(ciphertext, iv, 2)).toThrow()
  })

  it("supports multiple key versions side by side", () => {
    const v1 = encrypt("first")
    const key = Buffer.from(TEST_KEY_V2, "hex")
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 })
    const v2Ciphertext = Buffer.concat([
      cipher.update("second", "utf8"),
      cipher.final(),
      cipher.getAuthTag(),
    ])

    expect(decrypt(v1.ciphertext, v1.iv, 1)).toBe("first")
    expect(decrypt(v2Ciphertext, iv, 2)).toBe("second")
  })

  it("throws when the requested key version is not configured", () => {
    const { ciphertext, iv } = encrypt("secret")
    expect(() => decrypt(ciphertext, iv, 99)).toThrow(/version 99/)
  })
})

describe("maskToken", () => {
  let maskToken: typeof import("./encryption").maskToken

  beforeAll(async () => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY_V1)
    const mod = await import("./encryption")
    maskToken = mod.maskToken
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it("masks a long token showing first 8 and last 4 characters", () => {
    const token = "sk-proj-abcdefghijklmnopqrst"
    expect(maskToken(token)).toBe("sk-proj-••••qrst")
  })

  it("returns full mask for token with 16 or fewer characters", () => {
    expect(maskToken("short")).toBe("••••••••")
    expect(maskToken("exactly16chars!!")).toBe("••••••••")
  })

  it("handles token with exactly 17 characters", () => {
    const token = "12345678901234567"
    expect(maskToken(token)).toBe("12345678••••4567")
  })
})
