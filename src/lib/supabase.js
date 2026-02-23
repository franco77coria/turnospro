import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')

export const supabase = isConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

export const isSupabaseConfigured = isConfigured
