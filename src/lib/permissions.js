import { PERMISSIONS, ROLE_PERMISSIONS } from './data'

/**
 * Check if a role has a specific permission
 */
export function hasPermission(userRole, permission) {
    const perms = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS['Profesional'] || []
    return perms.includes(permission)
}

/**
 * Map dashboard pages to required permissions
 */
export const PAGE_PERMISSIONS = {
    '/dashboard': null, // everyone with access
    '/dashboard/calendar': PERMISSIONS.VIEW_APPOINTMENTS,
    '/dashboard/appointments': PERMISSIONS.VIEW_APPOINTMENTS,
    '/dashboard/clients': PERMISSIONS.VIEW_CLIENTS,
    '/dashboard/services': PERMISSIONS.EDIT_SERVICES,
    '/dashboard/team': PERMISSIONS.MANAGE_TEAM,
    '/dashboard/finance': PERMISSIONS.VIEW_FINANCE,
    '/dashboard/settings': PERMISSIONS.EDIT_SETTINGS,
    '/dashboard/analytics': PERMISSIONS.VIEW_REPORTS,
    '/dashboard/admin': 'superadmin',
    '/dashboard/marketing': PERMISSIONS.MANAGE_MARKETING,
    '/dashboard/inventory': PERMISSIONS.MANAGE_INVENTORY,
    '/dashboard/pos': PERMISSIONS.VIEW_FINANCE,
    '/dashboard/locations': PERMISSIONS.EDIT_SETTINGS,
}

/**
 * Get nav items filtered by role permissions
 */
export function filterNavByRole(navItems, userRole) {
    return navItems.filter(item => {
        const requiredPerm = PAGE_PERMISSIONS[item.href]
        if (!requiredPerm) return true // no permission needed
        if (requiredPerm === 'superadmin') return false // handled separately
        return hasPermission(userRole, requiredPerm)
    })
}

export { PERMISSIONS }
