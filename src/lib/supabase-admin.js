import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with the service role key.
 * This client bypasses RLS — only use in server-side API routes
 * that need elevated privileges (cron jobs, cancel routes, etc.)
 */
export function createSupabaseAdmin() {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server operations')
    }
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey)
}
