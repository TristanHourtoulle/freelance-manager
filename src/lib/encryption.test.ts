import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"

const TEST_KEY = "a".repeat(64)

describe("encryption", () => {
  let encrypt: typeof import("./encryption").encrypt
  let decrypt: typeof import("./encryption").decrypt
  let maskToken: typeof import("./encryption").maskToken

  beforeAll(async () => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY)
    const mod = await import("./encryption")
    encrypt = mod.encrypt
    decrypt = mod.decrypt
    maskToken = mod.maskToken
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it("encrypts and decrypts a string roundtrip", () => {
    const plaintext = "my-secret-api-key-12345"
    const { ciphertext, iv } = encrypt(plaintext)

    expect(ciphertext).toBeInstanceOf(Buffer)
    expect(iv).toBeInstanceOf(Buffer)
    expect(iv.length).toBe(12)

    const decrypted = decrypt(ciphertext, iv)
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
    const { ciphertext, iv } = encrypt("")
    expect(decrypt(ciphertext, iv)).toBe("")
  })

  it("handles unicode content", () => {
    const plaintext = "Hello, world!"
    const { ciphertext, iv } = encrypt(plaintext)
    expect(decrypt(ciphertext, iv)).toBe(plaintext)
  })

  it("fails to decrypt with tampered ciphertext", () => {
    const { ciphertext, iv } = encrypt("secret")
    ciphertext[0] = (ciphertext[0] ?? 0) ^ 0xff
    expect(() => decrypt(ciphertext, iv)).toThrow()
  })

  it("fails to decrypt with wrong IV", () => {
    const { ciphertext } = encrypt("secret")
    const wrongIv = Buffer.alloc(12, 0)
    expect(() => decrypt(ciphertext, wrongIv)).toThrow()
  })
})

describe("maskToken", () => {
  let maskToken: typeof import("./encryption").maskToken

  beforeAll(async () => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY)
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
