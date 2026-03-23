// Superadmin emails — server-side only
// Configure via env var SUPERADMIN_EMAILS (comma-separated)
// IMPORTANT: Do NOT use NEXT_PUBLIC_ prefix to avoid exposing emails in client bundle

const envEmails = process.env.SUPERADMIN_EMAILS || ''
export const SUPERADMIN_EMAILS = envEmails
    ? envEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    : []

export function isSuperAdmin(email) {
    if (!email || SUPERADMIN_EMAILS.length === 0) return false
    return SUPERADMIN_EMAILS.includes(email.toLowerCase())
}
