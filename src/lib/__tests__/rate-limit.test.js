import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need a fresh module for each test to reset the internal rateMap
let checkRate

beforeEach(async () => {
  vi.resetModules()
  // Re-import to get a fresh rateMap
  const mod = await import('../rate-limit.js')
  checkRate = mod.checkRate
})

describe('rate-limit', () => {
  describe('checkRate', () => {
    it('allows requests under limit', () => {
      const result1 = checkRate('test-ip-1', 5, 60000)
      expect(result1.success).toBe(true)
      expect(result1.remaining).toBe(4)

      const result2 = checkRate('test-ip-1', 5, 60000)
      expect(result2.success).toBe(true)
      expect(result2.remaining).toBe(3)
    })

    it('blocks requests over limit', () => {
      const key = 'test-ip-block'
      const limit = 3

      checkRate(key, limit, 60000) // 1
      checkRate(key, limit, 60000) // 2
      checkRate(key, limit, 60000) // 3

      const result = checkRate(key, limit, 60000) // 4 - over limit
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('resets after window expires', () => {
      const key = 'test-ip-reset'
      const limit = 2
      const windowMs = 1000

      checkRate(key, limit, windowMs) // 1
      checkRate(key, limit, windowMs) // 2
      const blocked = checkRate(key, limit, windowMs) // 3 - blocked
      expect(blocked.success).toBe(false)

      // Advance time past the window
      const realNow = Date.now
      vi.spyOn(Date, 'now').mockReturnValue(realNow() + windowMs + 1)

      const result = checkRate(key, limit, windowMs) // should be reset
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(1)

      vi.restoreAllMocks()
    })

    it('tracks different keys independently', () => {
      checkRate('key-a', 1, 60000)
      const blockedA = checkRate('key-a', 1, 60000)
      expect(blockedA.success).toBe(false)

      const resultB = checkRate('key-b', 1, 60000)
      expect(resultB.success).toBe(true)
    })
  })
})
