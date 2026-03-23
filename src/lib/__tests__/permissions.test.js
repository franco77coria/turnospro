import { describe, it, expect } from 'vitest'
import { hasPermission, PERMISSIONS } from '../permissions.js'

describe('permissions', () => {
  describe('hasPermission', () => {
    it('returns true for Dueno on all permissions', () => {
      for (const perm of Object.values(PERMISSIONS)) {
        expect(hasPermission('Dueño', perm)).toBe(true)
      }
    })

    it('returns true for Admin on all permissions', () => {
      for (const perm of Object.values(PERMISSIONS)) {
        expect(hasPermission('Admin', perm)).toBe(true)
      }
    })

    it('returns false for Profesional on admin-only permissions', () => {
      expect(hasPermission('Profesional', PERMISSIONS.MANAGE_TEAM)).toBe(false)
      expect(hasPermission('Profesional', PERMISSIONS.EDIT_SERVICES)).toBe(false)
      expect(hasPermission('Profesional', PERMISSIONS.EDIT_SETTINGS)).toBe(false)
      expect(hasPermission('Profesional', PERMISSIONS.MANAGE_MARKETING)).toBe(false)
      expect(hasPermission('Profesional', PERMISSIONS.MANAGE_INVENTORY)).toBe(false)
      expect(hasPermission('Profesional', PERMISSIONS.VIEW_REPORTS)).toBe(false)
    })

    it('handles Profesional role correctly - grants allowed permissions', () => {
      expect(hasPermission('Profesional', PERMISSIONS.VIEW_APPOINTMENTS)).toBe(true)
      expect(hasPermission('Profesional', PERMISSIONS.CREATE_APPOINTMENTS)).toBe(true)
      expect(hasPermission('Profesional', PERMISSIONS.VIEW_CLIENTS)).toBe(true)
      expect(hasPermission('Profesional', PERMISSIONS.VIEW_FINANCE)).toBe(true)
    })

    it('handles Recepcionista role correctly', () => {
      // Recepcionista can do
      expect(hasPermission('Recepcionista', PERMISSIONS.VIEW_APPOINTMENTS)).toBe(true)
      expect(hasPermission('Recepcionista', PERMISSIONS.CREATE_APPOINTMENTS)).toBe(true)
      expect(hasPermission('Recepcionista', PERMISSIONS.CANCEL_APPOINTMENTS)).toBe(true)
      expect(hasPermission('Recepcionista', PERMISSIONS.VIEW_CLIENTS)).toBe(true)
      expect(hasPermission('Recepcionista', PERMISSIONS.EDIT_CLIENTS)).toBe(true)
      expect(hasPermission('Recepcionista', PERMISSIONS.MANAGE_CASH)).toBe(true)

      // Recepcionista cannot do
      expect(hasPermission('Recepcionista', PERMISSIONS.MANAGE_TEAM)).toBe(false)
      expect(hasPermission('Recepcionista', PERMISSIONS.EDIT_SERVICES)).toBe(false)
      expect(hasPermission('Recepcionista', PERMISSIONS.EDIT_SETTINGS)).toBe(false)
      expect(hasPermission('Recepcionista', PERMISSIONS.VIEW_REPORTS)).toBe(false)
    })

    it('falls back to Profesional permissions for unknown roles', () => {
      expect(hasPermission('UnknownRole', PERMISSIONS.VIEW_APPOINTMENTS)).toBe(true)
      expect(hasPermission('UnknownRole', PERMISSIONS.MANAGE_TEAM)).toBe(false)
    })
  })
})
