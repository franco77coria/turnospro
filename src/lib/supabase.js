import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')

// Browser client using @supabase/ssr — persists session in cookies
export const supabase = isConfigured
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : null

export const isSupabaseConfigured = isConfigured
