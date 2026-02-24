// Superadmin emails that bypass onboarding
export const SUPERADMIN_EMAILS = ['1133985163f@gmail.com']

export function isSuperAdmin(email) {
    return SUPERADMIN_EMAILS.includes(email?.toLowerCase())
}
