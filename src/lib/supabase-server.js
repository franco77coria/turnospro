import { createServerClient } from '@supabase/ssr'

export function createSupabaseServerClient(cookies) {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return cookies.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookies.set(name, value, options)
                        )
                    } catch {
                        // setAll can fail in Server Components where cookies are readonly
                    }
                },
            },
        }
    )
}
