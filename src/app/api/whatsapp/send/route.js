import { NextResponse } from 'next/server'

// Canal deshabilitado hasta disponer de remitente verificado y consentimiento.
export async function POST() {
    return NextResponse.json({ error: 'El canal WhatsApp no está disponible' }, { status: 410 })
}
