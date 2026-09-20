export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { applyRateLimit } from '@/lib/rate-limit'
import { FeedbackSchema, parseBody } from '@/lib/schemas'
import { logError } from '@/lib/log'

/**
 * POST /api/feedback
 *
 * La tabla no acepta escrituras desde el navegador (ver migration-feedback.sql),
 * así que este es el único camino. Se escribe con service_role después de
 * validar y de aplicar rate-limit.
 *
 * Se acepta feedback sin sesión: el momento en que alguien se frustra y quiere
 * quejarse suele ser justo cuando no pudo entrar. Perder ese comentario sería
 * perder el más valioso.
 */
export async function POST(request) {
    try {
        const cookieStore = await cookies()
        const authClient = createSupabaseServerClient(cookieStore)
        const { data: { user } } = await authClient.auth.getUser()

        // Un usuario identificado puede mandar más; el anónimo es la puerta
        // por donde entraría el spam.
        const limitado = await applyRateLimit(request, {
            prefix: user ? `feedback:${user.id}` : 'feedback:anon',
            limit: user ? 5 : 2,
            windowMs: 10 * 60 * 1000,
        })
        if (limitado) return limitado

        const raw = await request.json().catch(() => null)
        const parsed = parseBody(FeedbackSchema, raw)
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 })
        }

        const { puntaje, tipo, mensaje, rol, ruta, business_id, contactable } = parsed.data

        const supabase = createSupabaseAdmin()

        const { error } = await supabase.from('feedback').insert([{
            user_id: user?.id || null,
            business_id: business_id || null,
            rol,
            puntaje: puntaje ?? null,
            tipo,
            mensaje,
            ruta: ruta || null,
            // Se corta: no aporta nada más allá de navegador y sistema, y los
            // user agents largos ensucian la tabla.
            user_agent: (request.headers.get('user-agent') || '').slice(0, 300) || null,
            // Sin sesión no hay a quién escribirle, por más que lo marque.
            contactable: contactable && Boolean(user),
        }])

        if (error) {
            logError('api/feedback', error)
            return NextResponse.json({ error: 'No se pudo guardar tu comentario' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        logError('api/feedback', err)
        // Mensaje en el idioma de la app: este error se le muestra a la
        // persona, no queda solo en los logs.
        return NextResponse.json(
            { error: 'No se pudo guardar tu comentario. Probá de nuevo en un momento.' },
            { status: 500 }
        )
    }
}
