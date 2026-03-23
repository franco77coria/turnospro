export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        )
        const { error } = await supabase.from('businesses').select('id').limit(1)
        if (error) throw error

        return NextResponse.json({
            status: 'ok',
            db: 'connected',
            timestamp: new Date().toISOString(),
        })
    } catch (err) {
        console.error('Health check failed:', err)
        return NextResponse.json(
            { status: 'error', message: 'DB connection failed' },
            { status: 503 }
        )
    }
}
