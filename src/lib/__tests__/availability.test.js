import { describe, it, expect, vi } from 'vitest'
import { filterAvailableSlots, checkSlotAvailability } from '../availability.js'

// We need to test the non-exported helpers indirectly, so we import the module
// and test timeToMinutes/minutesToTime through filterAvailableSlots behavior.
// However, we can also test them by importing the module source.

// Since timeToMinutes and minutesToTime are not exported, test them through behavior.
// But we can still verify their correctness indirectly.

describe('availability', () => {
  describe('timeToMinutes / minutesToTime (via filterAvailableSlots behavior)', () => {
    it('timeToMinutes converts correctly - slots at specific times are handled', () => {
      // A slot at "09:30" = 570 minutes. If we occupy 570-600, "09:30" with 30min service should be blocked
      const allSlots = ['09:00', '09:30', '10:00']
      const occupied = [{ startMin: 570, endMin: 600, team_member_id: null }] // 09:30-10:00
      const result = filterAvailableSlots(allSlots, occupied, 30)
      // 09:00 (540-570) does not overlap 570-600 -> available
      // 09:30 (570-600) overlaps 570-600 -> blocked
      // 10:00 (600-630) does not overlap 570-600 -> available
      expect(result).toEqual(['09:00', '10:00'])
    })

    it('minutesToTime converts correctly - verified through occupied slot end times', () => {
      // Occupied slot from 14:00 (840min) for 45 min = endMin 885 = 14:45
      const allSlots = ['14:00', '14:30', '15:00']
      const occupied = [{ startMin: 840, endMin: 885, team_member_id: null }]
      const result = filterAvailableSlots(allSlots, occupied, 30)
      // 14:00 (840-870) overlaps 840-885 -> blocked
      // 14:30 (870-900) overlaps 840-885 -> blocked
      // 15:00 (900-930) does not overlap 840-885 -> available
      expect(result).toEqual(['15:00'])
    })
  })

  describe('filterAvailableSlots', () => {
    const baseOccupied = [
      { startMin: 540, endMin: 570, team_member_id: 'tm-1' },  // 09:00-09:30
      { startMin: 600, endMin: 660, team_member_id: 'tm-2' },  // 10:00-11:00
    ]

    it('removes occupied slots', () => {
      const allSlots = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00']
      const result = filterAvailableSlots(allSlots, baseOccupied, 30)
      // 08:30 (510-540) -> ok
      // 09:00 (540-570) overlaps 540-570 -> blocked
      // 09:30 (570-600) -> ok
      // 10:00 (600-630) overlaps 600-660 -> blocked
      // 10:30 (630-660) overlaps 600-660 -> blocked
      // 11:00 (660-690) -> ok
      expect(result).toEqual(['08:30', '09:30', '11:00'])
    })

    it('respects buffer time via service duration', () => {
      // With a 60-min service, more slots get blocked
      const allSlots = ['08:00', '08:30', '09:00', '09:30']
      const occupied = [{ startMin: 540, endMin: 570, team_member_id: null }] // 09:00-09:30
      const result = filterAvailableSlots(allSlots, occupied, 60)
      // 08:00 (480-540) -> does NOT overlap 540-570 -> available
      // 08:30 (510-570) -> overlaps 540-570 -> blocked
      // 09:00 (540-600) -> overlaps 540-570 -> blocked
      // 09:30 (570-630) -> does NOT overlap 540-570 -> available
      expect(result).toEqual(['08:00', '09:30'])
    })

    it('filters by team member when specified', () => {
      const allSlots = ['09:00', '10:00']
      // 09:00 occupied by tm-1, 10:00 occupied by tm-2
      const result = filterAvailableSlots(allSlots, baseOccupied, 30, 'tm-1')
      // Only checks tm-1 slots: 09:00 blocked by tm-1, 10:00 not blocked by tm-1
      expect(result).toEqual(['10:00'])
    })

    it('returns all slots when none are occupied', () => {
      const allSlots = ['09:00', '09:30', '10:00']
      const result = filterAvailableSlots(allSlots, [], 30)
      expect(result).toEqual(['09:00', '09:30', '10:00'])
    })
  })

  describe('checkSlotAvailability', () => {
    it('detects conflicts with occupied slots', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: function () { return this },
            not: function () {
              return {
                eq: function () {
                  return { data: [{ time: '10:00', duration: 60, team_member_id: null }], error: null }
                },
                data: [{ time: '10:00', duration: 60, team_member_id: null }],
                error: null,
              }
            },
          }),
        }),
      }

      const result = await checkSlotAvailability(mockSupabase, 'biz-1', '2026-03-23', '10:30', 30)
      expect(result.available).toBe(false)
      expect(result.conflict).toBeTruthy()
    })

    it('returns available when no conflicts', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: function () { return this },
            not: function () {
              return {
                eq: function () {
                  return { data: [{ time: '10:00', duration: 30, team_member_id: null }], error: null }
                },
                data: [{ time: '10:00', duration: 30, team_member_id: null }],
                error: null,
              }
            },
          }),
        }),
      }

      const result = await checkSlotAvailability(mockSupabase, 'biz-1', '2026-03-23', '11:00', 30)
      expect(result.available).toBe(true)
      expect(result.conflict).toBeNull()
    })
  })
})
