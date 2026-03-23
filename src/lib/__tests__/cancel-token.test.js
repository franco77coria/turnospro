import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Set env before importing the module
process.env.CANCEL_TOKEN_SECRET = 'test-secret-key-for-testing'

const { generateCancelToken, verifyCancelToken } = await import('../cancel-token.js')

describe('cancel-token', () => {
  describe('generateCancelToken', () => {
    it('creates a valid base64url token', async () => {
      const token = await generateCancelToken('appointment-123')
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      // base64url should not contain +, /, or =
      expect(token).not.toMatch(/[+/=]/)
    })

    it('token decodes to appointmentId:timestamp:signature format', async () => {
      const token = await generateCancelToken('apt-456')
      const decoded = Buffer.from(token, 'base64url').toString()
      const parts = decoded.split(':')
      expect(parts).toHaveLength(3)
      expect(parts[0]).toBe('apt-456')
      expect(Number(parts[1])).toBeGreaterThan(0)
      expect(parts[2].length).toBeGreaterThan(0)
    })
  })

  describe('verifyCancelToken', () => {
    it('validates a freshly generated token', async () => {
      const token = await generateCancelToken('apt-789')
      const result = await verifyCancelToken(token)
      expect(result.valid).toBe(true)
      expect(result.appointmentId).toBe('apt-789')
    })

    it('rejects expired token (older than 30 days)', async () => {
      // Generate token, then advance time past 30 days
      const realNow = Date.now
      const baseTime = Date.now()

      // Generate at current time
      const token = await generateCancelToken('apt-expired')

      // Advance Date.now by 31 days
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + 31 * 24 * 60 * 60 * 1000)

      const result = await verifyCancelToken(token)
      expect(result.valid).toBe(false)
      expect(result.appointmentId).toBeNull()

      vi.restoreAllMocks()
    })

    it('rejects tampered signature', async () => {
      const token = await generateCancelToken('apt-tamper')
      const decoded = Buffer.from(token, 'base64url').toString()
      const parts = decoded.split(':')
      // Tamper with the signature
      parts[2] = 'tampered-signature-value'
      const tamperedToken = Buffer.from(parts.join(':')).toString('base64url')

      const result = await verifyCancelToken(tamperedToken)
      expect(result.valid).toBe(false)
      expect(result.appointmentId).toBeNull()
    })

    it('rejects invalid token format', async () => {
      const badToken = Buffer.from('just-no-colons').toString('base64url')
      const result = await verifyCancelToken(badToken)
      expect(result.valid).toBe(false)
      expect(result.appointmentId).toBeNull()
    })
  })
})
